-- SQL запрос для добавления колонки acknowledged_by в таблицу logs
-- Выполните этот запрос в Supabase SQL Editor, если колонка еще не существует

-- Добавить колонку acknowledged_by если таблица уже существует
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'logs' AND column_name = 'acknowledged_by'
  ) THEN
    ALTER TABLE logs ADD COLUMN acknowledged_by TEXT;
  END IF;
END $$;



