-- Create a new storage bucket for avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Policy to allow authenticated users to upload their own avatar
create policy "Authenticated users can upload avatars"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'avatars' AND auth.uid() = owner );

-- Policy to allow authenticated users to update their own avatar
create policy "Authenticated users can update avatars"
on storage.objects for update
to authenticated
using ( bucket_id = 'avatars' AND auth.uid() = owner );

-- Policy to allow anyone to view avatars
create policy "Anyone can view avatars"
on storage.objects for select
to public
using ( bucket_id = 'avatars' );

-- Policy to allow users to delete their own avatar
create policy "Authenticated users can delete avatars"
on storage.objects for delete
to authenticated
using ( bucket_id = 'avatars' AND auth.uid() = owner );
