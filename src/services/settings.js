import { supabase } from '../lib/supabase';

export const loadSettings = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('*');
  
  if (error) throw error;
  
  const multiplierSetting = data.find(s => s.key === 'overtimeMultiplier');
  return multiplierSetting ? parseFloat(multiplierSetting.value) : 1.5;
};


