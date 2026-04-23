-- Update model_feedback table to allow new provider types
-- This modifies the CHECK constraint to include the new OpenAI model variants

ALTER TABLE model_feedback 
DROP CONSTRAINT IF EXISTS model_feedback_model_provider_check;

ALTER TABLE model_feedback 
ADD CONSTRAINT model_feedback_model_provider_check 
CHECK (model_provider IN ('openai', 'openai_mini', 'openai_1_5', 'gemini_flash', 'nano_banana_pro'));
