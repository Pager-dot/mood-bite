export type Role = "user" | "assistant";

export type Place = {
  name: string;
  dish: string;
  distanceM: number;
  cuisine: string;
  priceBand: "₹" | "₹₹" | "₹₹₹";
  mapsUrl: string;
};

export type ChatReply = {
  mode: "ask" | "recommend";
  reply: string;
  primary?: Place;
  alternates?: Place[];
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  primary?: Place;
  alternates?: Place[];
};
