export interface AnimeItem {
  title: string;
  slug: string;
  poster: string | null;
  type: "movie" | "series";
}

export interface Episode {
  season: number;
  episode: number;
  title: string;
  url: string;
  thumbnail?: string;
}

export interface AnimeDetails {
  title: string | null;
  slug: string;
  description: string | null;
  poster: string | null;
  genres: string[];
  year: string | null;
  runtime: string | null;
  episodes: Episode[];
  type: "movie" | "series";
}

export interface StreamSourceOption {
  id: string;
  name: string;
}

export interface Stream {
  player?: string;
  source?: string;
  url: string;
}

export interface StreamResponse {
  streams: Stream[];
}


