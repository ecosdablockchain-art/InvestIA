// Finanças 360 — serviço "notificar" (Supabase Edge Function).
// Cole este arquivo inteiro em: Edge Functions › Deploy a new function › Via Editor › nome "notificar".
// Desligue "Verify JWT" (o serviço confere o acesso por conta própria).
// Gerado a partir de logica.ts + servico.ts: não edite à mão.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
