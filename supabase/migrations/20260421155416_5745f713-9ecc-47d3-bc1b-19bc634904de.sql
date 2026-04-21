UPDATE public.business_settings
SET use_elevenlabs_voice = true
WHERE business_id = '156b9852-7782-4012-b054-b7df0e58c135';

INSERT INTO public.business_settings (business_id, use_elevenlabs_voice)
SELECT '156b9852-7782-4012-b054-b7df0e58c135', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_settings WHERE business_id = '156b9852-7782-4012-b054-b7df0e58c135'
);