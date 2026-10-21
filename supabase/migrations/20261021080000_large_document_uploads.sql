-- Manuales, fichas y demás documentos de la librería pueden pesar cientos de MB.
-- El bucket sales-catalog tenía 50 MB; se abre a 2 GB (tope de proyecto aparte).

update storage.buckets
set file_size_limit = 2147483648
where id = 'sales-catalog';
