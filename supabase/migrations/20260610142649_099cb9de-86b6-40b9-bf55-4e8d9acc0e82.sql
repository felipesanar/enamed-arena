ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url_2 text;

UPDATE public.questions
SET image_url_2 = 'https://lljnbysgcwvkhlnaqxtt.supabase.co/storage/v1/object/public/question-images/98ee6732-9a6e-44ef-96fe-0b400b8bba31/12_enunciado_2.jpg'
WHERE simulado_id = '98ee6732-9a6e-44ef-96fe-0b400b8bba31' AND question_number = 12;