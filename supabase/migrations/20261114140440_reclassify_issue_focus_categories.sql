alter table public.issues drop constraint issues_category_check;

-- Reclassify the reviewed issues by ID, without changing publication or content.
update public.issues as issue
set category = assignment.category
from (values
  ('e53218dd-9921-4fa4-b7f8-aa28609c8ebe'::uuid, 'technology'),
  ('80454499-d312-46c1-9c83-bc31eae653d2'::uuid, 'technology'),
  ('5b7360b7-ee50-4313-a159-77a645c2a962'::uuid, 'technology'),
  ('fbf476a1-ffbe-4d0c-a8f9-4d1bd604d90b'::uuid, 'technology'),
  ('e911f2ac-1d12-4bfe-90ca-4c73e9488b7d'::uuid, 'technology'),
  ('7569d1dd-f956-42c6-bb1a-d36feef1f964'::uuid, 'technology'),
  ('8c423f3e-15bb-48ef-ab78-f1975e2c0ecc'::uuid, 'platform'),
  ('4bfcbf17-23d6-4ad2-a5cd-6b4148e44792'::uuid, 'platform'),
  ('06aedd23-3ed6-4925-b3bd-72373d91c781'::uuid, 'platform'),
  ('c6550975-dfc4-4810-9cbf-e9080df6ad9b'::uuid, 'platform'),
  ('316b2c38-6350-4482-817f-885eb68b5dd6'::uuid, 'platform'),
  ('78f9b0a8-0622-4495-b36f-c39132f1cf58'::uuid, 'platform'),
  ('731fc3eb-4019-4c2a-97ad-8a5db6ddb9cc'::uuid, 'platform'),
  ('d3efb23e-02ad-445c-896a-740fff521a85'::uuid, 'marketing'),
  ('4e131fd7-6f28-4219-96d5-3963fbbabc1d'::uuid, 'marketing'),
  ('429c3f84-0e14-4ebe-a1bf-eff0dbe6c64d'::uuid, 'marketing'),
  ('9017ad87-4584-487a-9f4b-f623f15d7f66'::uuid, 'marketing'),
  ('9f69bdfa-fc98-4727-a483-847f26b6f588'::uuid, 'commerce'),
  ('0360b0a3-dddc-4663-807b-d83a1f7f3d46'::uuid, 'commerce'),
  ('48e0c2fc-e5fc-40d5-8ce6-60997f039a55'::uuid, 'commerce'),
  ('a001e3d2-9cc5-4291-850f-188b02c1de4e'::uuid, 'commerce'),
  ('80dc0f19-e804-4279-8e1c-c591bc2d07cf'::uuid, 'commerce'),
  ('84d63764-9fe5-40c2-b91a-6aaa70ab9075'::uuid, 'commerce'),
  ('055e64fc-cdb3-49c3-8240-64e4a1252b8e'::uuid, 'commerce'),
  ('162fa6b2-b7d5-4cc3-a382-3d2b2cfce91b'::uuid, 'commerce'),
  ('cc173504-8446-4c5c-a79e-f54d4747c940'::uuid, 'commerce'),
  ('9a61a991-2611-4e05-9a80-292a55099e35'::uuid, 'commerce'),
  ('46227da6-c2ab-4254-80da-0e2b7f7d8863'::uuid, 'commerce'),
  ('69589fa3-8d1d-4219-8117-817fa0bd0a08'::uuid, 'commerce'),
  ('28b6ad77-cb42-4f26-9bd0-e74d8cfd5c9f'::uuid, 'commerce'),
  ('8d86f5c6-0e2c-423b-948e-26db64a61a55'::uuid, 'creator'),
  ('b6109a20-d4fe-4bf6-990b-d9f9d18e5a46'::uuid, 'creator'),
  ('b1a6ea30-2e64-4c67-a1b9-f4293eade5ad'::uuid, 'creator'),
  ('efae6e9f-f8d0-447a-ae50-a5d9023e5f82'::uuid, null),
  ('9f2081dd-4eb6-480c-ab03-00e43773d352'::uuid, null),
  ('c7ec6b0e-678b-470e-834a-f40b0b647a6c'::uuid, null),
  ('d22181d8-f485-451c-a7f2-569ba54b98a1'::uuid, null)
) as assignment(id, category)
where issue.id = assignment.id
  and issue.category is distinct from assignment.category;

alter table public.issues
  add constraint issues_category_check
  check (category in ('technology', 'platform', 'marketing', 'commerce', 'creator'));
