import { supabase } from '../lib/supabase';

export const loadUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data;
};

export const updateUserName = async (email, name) => {
  const { data, error } = await supabase
    .from('users')
    .update({ name })
    .eq('email', email)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateUserRole = async (email, role) => {
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('email', email)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteUser = async (email) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('email', email);
  
  if (error) throw error;
};


