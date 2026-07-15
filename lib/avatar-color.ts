const PALETTE = ['#579bfc', '#a25ddc', '#ff642e', '#00c875', '#e2445c', '#fdab3d', '#66ccff', '#037f4c'];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  const chars = parts.length > 1 ? [parts[0][0], parts[1][0]] : [local[0], local[1]];
  return chars.filter(Boolean).join('').toUpperCase().slice(0, 2);
}
