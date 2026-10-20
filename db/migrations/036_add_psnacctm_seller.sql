-- Add psnacctm.com ("پی اس ان اکانت", a Sazito shop) to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 036_add_psnacctm_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('psnacctm', 'پی اس ان اکانت', 'psnacctm.com')
ON CONFLICT (slug) DO NOTHING;
