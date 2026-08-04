-- ============================================================================
-- Data backfill: correct unit of measure (most items are 'pcs', but raw
-- wire/cable/rope stock is tracked by length) and collapse the previously
-- inconsistent free-text category values ("clarin materials", "Siemens
-- Product", "Siemens Product cebu(2)", "Materials", "Tools and Tester", ...)
-- down to two clean categories: 'Consumables' and 'Tools'.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

update public.inventory_items
set unit = 'meters'
where id in (
  '362ae5ef-e215-41b3-a0b5-d054c4f50135', -- 3 core wire .75mm
  'dfd724f2-0d5a-4b4f-b941-fc6f1b2c41ba', -- 7 core wire
  '95a5a0aa-4bc0-4679-8f4d-36553cea07dc', -- ethernet cable
  '1baec06c-3ad3-4818-8e92-05d4a9b3c606', -- RS485 Cable
  '79180adc-207e-4c22-bfda-bc525928ebbe', -- TF cables (.75, 1.5)
  'e604e57b-02ea-4184-a194-6ed550eded16', -- rope blue
  '0f23db8e-1a81-4d5a-a887-6377a951a847'  -- wire wrap
);

-- Everything defaults to Consumables (materials, connectors, Siemens/Schneider
-- parts, terminal blocks, cabling, etc. — all stock that gets installed/used
-- up on a job)...
update public.inventory_items set category = 'Consumables';

-- ...except reusable hand/power tools and test equipment.
update public.inventory_items
set category = 'Tools'
where id in (
  'a3d99bd8-7439-4776-bedc-ae13b83a2111', -- Electric Drill
  '93e1767b-5b5c-4764-8c34-d796e8c37441', -- fiber optic fusioner
  '3f249487-c735-4c79-9a56-7c696ef47517', -- fiber optic tester
  'a950000c-255c-4814-afdd-530fc7903362', -- fire extinguisher
  '9dc940f3-94fb-44c2-9df8-6961569f34b9', -- fluke tester
  'a018c7bc-d2ca-49da-958c-298527345873', -- grinder
  '7f842ca1-7a5a-4cb8-a0dd-4d8d2a49d82b', -- jack hammer
  '911f3781-6225-435d-a93f-c06cd111951d', -- pipe bender
  '668d82a7-96d8-4637-9a77-87a3fc56f311', -- pipe threader
  '46804b16-c6a4-47bf-bd1c-0f0d53701ded', -- portable drill
  'cd15b433-a7f0-4d7e-86d2-ae0ec42b16f1', -- portable welding machine
  '0d205d7d-140d-4211-8f19-f07d2ec696c7', -- shovel
  'a6e6d4cb-1ad3-4c98-8ce4-2e704dc3c743', -- Sledge hammer
  '7281ee25-46e0-4e75-aa5f-1a0073978ecf', -- temp tester
  '84ec4eda-760b-480e-a043-9c2241063fb6', -- tube printer
  'e34db722-1eca-40e1-9e27-2fb6ea74d2b5', -- vaccum
  'e9be258c-d461-4bab-a3e8-9bd1b4090a1a'  -- tool box big (assorted)
);
