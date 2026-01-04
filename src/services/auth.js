import { supabase } from '../lib/supabase';

export const findUserByEmail = async (email) => {
  if (!email) return null;
  
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('email', normalizedEmail)
      .maybeSingle();
    
    if (error) {
      console.error('Error finding user:', error.message);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error searching for user:', error);
    return null;
  }
};

export const createUser = async (email, name) => {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        role: 'user'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const signInWithEmail = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  return data;
};

export const signUpWithEmail = async (email, password, name) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });
  
  if (error) throw error;
  return data;
};

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  
  if (error) throw error;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};


