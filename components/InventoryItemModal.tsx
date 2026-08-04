'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import type { InventoryItem, InventoryLocation, InventoryStock, InventoryStockMovement, MemberProfile } from '@/types/database';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { LocationCombobox } from './LocationCombobox';
import { StockAdjuster } from './StockAdjuster';
import { InventoryPhotosPanel } from './InventoryPhotosPanel';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { MAX_PHOTO_SIZE_BYTES, uploadInventoryPhoto } from '@/lib/inventory-photos';
import {
  addStockLocation,
  createInventoryItem,
  deleteInventoryItem,
  getStockMovements,
  removeStockLocation,
  updateInventoryItem,
} from '@/lib/inventory-mutations';

interface StagedPhoto {
  file: File;
  url: string;
}

interface DraftRow {
  key: string;
  locationId: string | null;
  locationName: string;
  quantity: string;
}

const COMMON_UNITS = ['pcs', 'box', 'set', 'pack', 'roll', 'meters', 'kg', 'liters'];

function newDraftRow(): DraftRow {
  return { key: crypto.randomUUID(), locationId: null, locationName: '', quantity: '' };
}

export function InventoryItemModal({
  workspaceId,
  item,
  locations,
  stockForItem,
  members,
  canEdit,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  onStockChanged,
  onLocationCreated,
  onCoverPhotoChange,
}: {
  workspaceId: string;
  item: InventoryItem | null;
  locations: InventoryLocation[];
  stockForItem: InventoryStock[];
  members: MemberProfile[];
  canEdit: boolean;
  onClose: () => void;
  onCreated: (item: InventoryItem, stock: InventoryStock[]) => void;
  onUpdated: (item: InventoryItem) => void;
  onDeleted: (itemId: string) => void;
  onStockChanged: (stock: InventoryStock) => void;
  onLocationCreated: (location: InventoryLocation) => void;
  onCoverPhotoChange: (itemId: string, url: string | null) => void;
}) {
  const [savedItem, setSavedItem] = useState<InventoryItem | null>(item);
  const [locationList, setLocationList] = useState<InventoryLocation[]>(locations);
  const [stock, setStock] = useState<InventoryStock[]>(stockForItem);
  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'pcs');
  const [unitCost, setUnitCost] = useState(item?.unit_cost != null ? String(item.unit_cost) : '');
  const [reorderPoint, setReorderPoint] = useState(item ? String(item.reorder_point) : '0');
  const [draftRows, setDraftRows] = useState<DraftRow[]>(item ? [] : [newDraftRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [movements, setMovements] = useState<InventoryStockMovement[]>([]);
  // Photos picked before the item exists (create mode) — uploaded once
  // handleSave gets back a real item id, since the storage path needs one.
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const stagedPhotosRef = useRef(stagedPhotos);
  const stagedInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    stagedPhotosRef.current = stagedPhotos;
  }, [stagedPhotos]);

  useEffect(() => {
    return () => {
      stagedPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const savedItemId = savedItem?.id;
  useEffect(() => {
    if (!savedItemId) return;
    let cancelled = false;
    getStockMovements(savedItemId).then((data) => {
      if (!cancelled) setMovements(data);
    });
    return () => {
      cancelled = true;
    };
  }, [savedItemId]);

  const memberByUserId = new Map(members.map((m) => [m.user_id, m]));
  const existingLocationIds = stock.map((s) => s.location_id);

  function updateDraftRow(key: string, patch: Partial<DraftRow>) {
    setDraftRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeDraftRow(key: string) {
    setDraftRows((prev) => prev.filter((r) => r.key !== key));
  }

  function excludeIdsFor(rowKey: string): string[] {
    return [
      ...existingLocationIds,
      ...draftRows.filter((r) => r.key !== rowKey && r.locationId).map((r) => r.locationId as string),
    ];
  }

  async function confirmAddLocation(row: DraftRow) {
    if (!savedItem || !row.locationId) return;
    setError(null);
    try {
      const newStock = await addStockLocation(savedItem.id, row.locationId, row.locationName, Number(row.quantity) || 0);
      setStock((prev) => [...prev, newStock]);
      onStockChanged(newStock);
      removeDraftRow(row.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add location');
    }
  }

  async function handleRemoveStockRow(row: InventoryStock) {
    if (row.quantity !== 0) return;
    setStock((prev) => prev.filter((s) => s.id !== row.id));
    await removeStockLocation(row.id);
  }

  function handleStageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted: StagedPhoto[] = [];
    let rejected = false;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_SIZE_BYTES) {
        rejected = true;
        continue;
      }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    if (rejected) setError('Only image files under 10MB can be added.');
    if (accepted.length > 0) setStagedPhotos((prev) => [...prev, ...accepted]);
  }

  function removeStagedPhoto(url: string) {
    setStagedPhotos((prev) => {
      const target = prev.find((p) => p.url === url);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.url !== url);
    });
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const patch = {
        name: trimmedName,
        sku: sku.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        unit: unit.trim() || 'pcs',
        unit_cost: unitCost.trim() ? Number(unitCost) : null,
        reorder_point: reorderPoint.trim() ? Number(reorderPoint) : 0,
      };

      if (!savedItem) {
        const locationsInput = draftRows
          .filter((r) => r.locationId)
          .map((r) => ({ locationId: r.locationId as string, locationName: r.locationName, quantity: Number(r.quantity) || 0 }));
        const { item: created, stock: createdStock } = await createInventoryItem(workspaceId, {
          ...patch,
          locations: locationsInput,
        });
        setSavedItem(created);
        setStock(createdStock);
        setDraftRows([]);
        onCreated(created, createdStock);

        const failedUploads: string[] = [];
        for (const staged of stagedPhotos) {
          try {
            await uploadInventoryPhoto(workspaceId, created.id, staged.file);
          } catch {
            failedUploads.push(staged.file.name);
          }
          URL.revokeObjectURL(staged.url);
        }
        setStagedPhotos([]);
        if (failedUploads.length > 0) {
          setError(`Item saved, but failed to upload: ${failedUploads.join(', ')}`);
        }
      } else {
        await updateInventoryItem(savedItem.id, patch);
        const updated = { ...savedItem, ...patch };
        setSavedItem(updated);
        onUpdated(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!savedItem) return;
    await deleteInventoryItem(savedItem);
    onDeleted(savedItem.id);
    onClose();
  }

  const readOnly = !canEdit;

  return (
    <Modal onClose={onClose} widthClassName="max-w-2xl">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly={readOnly}
          placeholder="Item name"
          className="mb-4 w-full rounded px-1 -mx-1 text-lg font-semibold text-gray-900 outline-none hover:bg-gray-50 focus:bg-gray-50"
        />

        <div className="mb-5 grid grid-cols-2 gap-3">
          <Field label="SKU / Order Code">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              readOnly={readOnly}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
            />
          </Field>
          <Field label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              readOnly={readOnly}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
            />
          </Field>
          <Field label="Unit">
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              readOnly={readOnly}
              list="inventory-unit-options"
              placeholder="pcs"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
            />
            <datalist id="inventory-unit-options">
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label="Unit cost">
            <input
              type="number"
              step="0.01"
              min={0}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              readOnly={readOnly}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
            />
          </Field>
          <Field label="Reorder point">
            <input
              type="number"
              min={0}
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              readOnly={readOnly}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={readOnly}
                rows={2}
                className="w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
              />
            </Field>
          </div>
        </div>

        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Locations &amp; Quantity ({unit.trim() || 'pcs'})
          </h3>
          <div className="space-y-2">
            {stock.map((row) => {
              const location = locationList.find((l) => l.id === row.location_id);
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-sm text-gray-700">{location?.name ?? 'Unknown'}</span>
                  <span className="w-14 shrink-0 text-right text-sm font-medium text-gray-900">
                    {row.quantity} {unit.trim() || 'pcs'}
                  </span>
                  {canEdit && savedItem && (
                    <StockAdjuster
                      itemId={savedItem.id}
                      locationId={row.location_id}
                      locationName={location?.name ?? ''}
                      onAdjusted={({ stock: newStock, movement }) => {
                        setStock((prev) => prev.map((s) => (s.id === newStock.id ? newStock : s)));
                        setMovements((prev) => [movement, ...prev]);
                        onStockChanged(newStock);
                      }}
                    />
                  )}
                  {canEdit && row.quantity === 0 && (
                    <button
                      onClick={() => handleRemoveStockRow(row)}
                      title="Remove location"
                      className="shrink-0 text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}

            {canEdit &&
              draftRows.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <div className="w-40 shrink-0">
                    <LocationCombobox
                      workspaceId={workspaceId}
                      locations={locationList}
                      excludeLocationIds={excludeIdsFor(row.key)}
                      value={row.locationId}
                      onChange={(id, locationName) => updateDraftRow(row.key, { locationId: id, locationName })}
                      onLocationCreated={(location) => {
                        setLocationList((prev) => [...prev, location]);
                        onLocationCreated(location);
                      }}
                    />
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={row.quantity}
                    onChange={(e) => updateDraftRow(row.key, { quantity: e.target.value })}
                    placeholder="Qty"
                    className="w-20 rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
                  />
                  {savedItem && (
                    <button
                      onClick={() => confirmAddLocation(row)}
                      disabled={!row.locationId}
                      className="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                    >
                      Add
                    </button>
                  )}
                  {(savedItem || draftRows.length > 1) && (
                    <button onClick={() => removeDraftRow(row.key)} className="shrink-0 text-gray-300 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}

            {canEdit && (
              <button
                onClick={() => setDraftRows((prev) => [...prev, newDraftRow()])}
                className="text-xs font-medium text-[#0073ea] hover:underline"
              >
                + Add another location
              </button>
            )}
          </div>
        </div>

        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Photos</h3>
          {savedItem ? (
            <InventoryPhotosPanel itemId={savedItem.id} workspaceId={workspaceId} onCoverPhotoChange={onCoverPhotoChange} />
          ) : (
            canEdit && (
              <div className="space-y-2">
                {stagedPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {stagedPhotos.map((p) => (
                      <div key={p.url} className="group relative aspect-square overflow-hidden rounded border border-gray-200 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.file.name} className="h-full w-full object-cover" />
                        <button
                          onClick={() => removeStagedPhoto(p.url)}
                          title="Remove photo"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 hover:bg-black/70 group-hover:opacity-100"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleStageFiles(e.dataTransfer.files);
                  }}
                  onClick={() => stagedInputRef.current?.click()}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed px-3 py-3 text-xs ${
                    dragOver ? 'border-[#0073ea] bg-blue-50 text-[#0073ea]' : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <Upload size={13} />
                  Click or drop photos — they&apos;ll upload once you save (max 10MB)
                  <input
                    ref={stagedInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleStageFiles(e.target.files)}
                  />
                </div>
              </div>
            )
          )}
        </div>

        {savedItem && movements.length > 0 && (
          <div className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Stock history</h3>
            <div className="space-y-1.5">
              {movements.map((m) => {
                const actor = m.created_by ? memberByUserId.get(m.created_by) : undefined;
                return (
                  <div key={m.id} className="flex items-center gap-2 text-xs">
                    {actor && (
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold text-white"
                        style={{ backgroundColor: avatarColor(actor.user_id) }}
                        title={displayName(actor)}
                      >
                        {initials(actor)}
                      </span>
                    )}
                    <span className={m.change > 0 ? 'font-medium text-[#00c875]' : 'font-medium text-[#e2445c]'}>
                      {m.change > 0 ? `+${m.change}` : m.change}
                    </span>
                    <span className="text-gray-500">{m.location_name}</span>
                    {actor && <span className="truncate text-gray-400">by {displayName(actor)}</span>}
                    {m.reason && <span className="truncate text-gray-400">— {m.reason}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div>
            {canEdit && savedItem && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete item
              </button>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this item?"
          message="This permanently deletes the item, its stock history, and its photos."
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}
