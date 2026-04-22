-- =====================================================
-- ADD NEW TOKEN TRANSACTION TYPES FOR IMAGE LIBRARY
-- Adds: upload, transform, save_variation, download_hires
-- =====================================================

-- Add new transaction types to the enum
ALTER TYPE token_transaction_type ADD VALUE IF NOT EXISTS 'upload';
ALTER TYPE token_transaction_type ADD VALUE IF NOT EXISTS 'transform';
ALTER TYPE token_transaction_type ADD VALUE IF NOT EXISTS 'save_variation';
ALTER TYPE token_transaction_type ADD VALUE IF NOT EXISTS 'download_hires';
