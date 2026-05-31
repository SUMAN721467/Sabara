import mat1 from "@/assets/mat-1.jpg";
import mat2 from "@/assets/mat-2.jpg";
import mat3 from "@/assets/mat-3.jpg";
import mat4 from "@/assets/mat-4.jpg";
import mat5 from "@/assets/mat-5.jpg";
import mat6 from "@/assets/mat-6.jpg";

export type Category = string;

export type Product = {
  id: string;
  name: string;
  price: number;
  original_price?: number | null;
  category: Category;
  materials: string;
  dimensions: string;
  story: string;
  image: string;
  gallery: string[];
  badge?: string;
};

export const products: Product[] = [
  {
    id: "kaira-round",
    name: "Kaira Round Floor Mat",
    price: 7400,
    category: "Floor",
    materials: "Jute + cotton, sage trim",
    dimensions: "Ø 90 cm",
    story:
      "Coiled by hand over three days from undyed jute and a soft sage cotton edge. Sits softly in entryways and bedside corners.",
    image: mat1,
    gallery: [mat1, mat5, mat2, mat6],
    badge: "Handwoven",
  },
  {
    id: "asha-yoga",
    name: "Asha Yoga Mat",
    price: 10300,
    category: "Yoga",
    materials: "Organic cotton, plant-dyed",
    dimensions: "180 × 65 cm",
    story:
      "A grounding mat with a quiet stripe and tassel finish, woven on a pit loom and washed for softness.",
    image: mat2,
    gallery: [mat2, mat6, mat1, mat5],
  },
  {
    id: "ravi-coir",
    name: "Ravi Coir Doormat",
    price: 3150,
    category: "Doormat",
    materials: "Natural coir fibre",
    dimensions: "60 × 40 cm",
    story:
      "Sturdy coir crocheted into a tight, hard-wearing weave. Made to welcome muddy boots for years.",
    image: mat3,
    gallery: [mat3, mat1, mat4, mat5],
  },
  {
    id: "saanvi-placemats",
    name: "Saanvi Placemat Set",
    price: 4650,
    category: "Table",
    materials: "Handloom cotton, set of 4",
    dimensions: "45 × 32 cm each",
    story:
      "Sage and ivory stripes woven on a four-shaft loom. Soft enough to fold, dense enough to last a decade of dinners.",
    image: mat4,
    gallery: [mat4, mat3, mat1, mat5],
    badge: "Set of 4",
  },
  {
    id: "meera-seagrass",
    name: "Meera Seagrass Rug",
    price: 13450,
    category: "Floor",
    materials: "Seagrass, herringbone weave",
    dimensions: "180 × 120 cm",
    story:
      "A larger floor piece in living-room scale. Its herringbone pattern shifts with the light through the day.",
    image: mat5,
    gallery: [mat5, mat1, mat2, mat6],
  },
  {
    id: "tara-meditation",
    name: "Tara Meditation Square",
    price: 5980,
    category: "Yoga",
    materials: "Jute base, sage tassels",
    dimensions: "70 × 70 cm",
    story:
      "A small, quiet square for morning sitting. The sage tassels are tied by hand at the close of each piece.",
    image: mat6,
    gallery: [mat6, mat2, mat1, mat5],
  },
  {
    id: "isha-runner",
    name: "Isha Table Runner",
    price: 3980,
    category: "Table",
    materials: "Handloom cotton",
    dimensions: "160 × 35 cm",
    story:
      "A long, breezy runner for everyday tables and slow weekend lunches.",
    image: mat4,
    gallery: [mat4, mat3, mat1, mat5],
  },
  {
    id: "noor-entry",
    name: "Noor Entry Mat",
    price: 5310,
    category: "Doormat",
    materials: "Jute + cotton weft",
    dimensions: "75 × 45 cm",
    story:
      "A softer doormat for inside the threshold, with a fine cotton weft woven through jute warp.",
    image: mat1,
    gallery: [mat1, mat3, mat4, mat5],
  },
];

export const categories: Category[] = ["Floor", "Yoga", "Doormat", "Table"];

export function getProduct(id: string) {
  return products.find((p) => p.id === id);
}

export function getRelated(id: string, limit = 3) {
  const p = getProduct(id);
  if (!p) return [];
  return products.filter((x) => x.id !== id && x.category === p.category).slice(0, limit);
}
