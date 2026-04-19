export type CatchRecord = {
  id: string;
  user_id: string;
  species: string;
  weight: number | null;
  length: number | null;
  location: string | null;
  water_type: 'river' | 'lake' | 'sea' | 'pond' | null;
  bait: string | null;
  status: 'want_to_catch' | 'fishing' | 'caught';
  rating: number | null;
  notes: string | null;
  date_added: string;
  caught_at: string | null;
  photo_url: string | null;
};
