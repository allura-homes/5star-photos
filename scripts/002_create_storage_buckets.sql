-- Create storage buckets for original uploads, previews, and final images
-- Note: This uses Supabase storage commands

-- Create buckets
insert into storage.buckets (id, name, public)
values 
  ('original-uploads', 'original-uploads', true),
  ('preview-images', 'preview-images', true),
  ('final-images', 'final-images', true)
on conflict (id) do nothing;

-- Set up policies for public access (MVP has no auth)
create policy "original-uploads_select_all"
  on storage.objects for select
  using (bucket_id = 'original-uploads');

create policy "original-uploads_insert_all"
  on storage.objects for insert
  with check (bucket_id = 'original-uploads');

create policy "original-uploads_delete_all"
  on storage.objects for delete
  using (bucket_id = 'original-uploads');

create policy "preview-images_select_all"
  on storage.objects for select
  using (bucket_id = 'preview-images');

create policy "preview-images_insert_all"
  on storage.objects for insert
  with check (bucket_id = 'preview-images');

create policy "preview-images_delete_all"
  on storage.objects for delete
  using (bucket_id = 'preview-images');

create policy "final-images_select_all"
  on storage.objects for select
  using (bucket_id = 'final-images');

create policy "final-images_insert_all"
  on storage.objects for insert
  with check (bucket_id = 'final-images');

create policy "final-images_delete_all"
  on storage.objects for delete
  using (bucket_id = 'final-images');
