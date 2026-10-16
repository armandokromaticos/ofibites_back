/**
 * Seed de datos de prueba: catálogo realista (productos, tamaños, modificadores, galería, ingredientes,
 * nutrición, tags, secciones y combos) y, si hay `SEED_DEMO_PASSWORD`, una empresa demo con dos usuarios
 * de Supabase Auth, un carrito con ítems y un historial de pedidos (dashboard). Siempre: banners del carrusel.
 *
 * Los IDs son fijos (deterministas), así las rutas `/producto/<id>` del front son estables entre ejecuciones.
 *
 * Idempotente: se puede ejecutar varias veces (upsert por ID; galería, ingredientes, tags, ítems de combo y
 * carrito se reescriben). Tags, secciones e ingredientes que ya existan por nombre o slug no se modifican.
 *
 * No corre con NODE_ENV=production y exige SEED_CONFIRM igual al host de DATABASE_URL:
 *
 *   SEED_CONFIRM=<host> yarn seed                            # solo catálogo
 *   SEED_CONFIRM=<host> SEED_DEMO_PASSWORD='...' yarn seed   # catálogo + empresa, usuarios y carrito demo
 */
import { PrismaClient, CompanyRole, Role } from "@prisma/client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const DIA_MS = 24 * 60 * 60 * 1000;
/** Fuera de la ventana de "nuevos" (30 días) para los que no lo son. */
const CREADO_ANTES = new Date(Date.now() - 90 * DIA_MS);

const pad = (n: number) => String(n).padStart(12, "0");
const productId = (n: number) => `c0ffee01-0000-4000-8000-${pad(n)}`;
const comboId = (n: number) => `c0ffee02-0000-4000-8000-${pad(n)}`;
const sizeId = (n: number) => `512e0000-0000-4000-8000-${pad(n)}`;
const ingredientId = (n: number) => `1a6e0000-0000-4000-8000-${pad(n)}`;
const groupId = (n: number) => `40d10000-0000-4000-8000-${pad(n)}`;
const modifierId = (n: number) => `40d20000-0000-4000-8000-${pad(n)}`;

// ============================================
// Catálogo
// ============================================

const TAGS = {
  keto: {
    id: "7a3c1e52-4f0b-4d2a-9c1e-1b2f3a4c5d01",
    nameEs: "Keto",
    nameEn: "Keto",
  },
  saludable: {
    id: "7a3c1e52-4f0b-4d2a-9c1e-1b2f3a4c5d02",
    nameEs: "Saludable",
    nameEn: "Healthy",
  },
  sinGluten: {
    id: "7a3c1e52-4f0b-4d2a-9c1e-1b2f3a4c5d03",
    nameEs: "Sin gluten",
    nameEn: "Gluten free",
  },
  vegano: {
    id: "7a3c1e52-4f0b-4d2a-9c1e-1b2f3a4c5d04",
    nameEs: "Vegano",
    nameEn: "Vegan",
  },
};
type TagKey = keyof typeof TAGS;

const SECCIONES = [
  {
    slug: "recomendados-de-la-semana",
    nameEs: "Recomendados de la semana",
    nameEn: "This week's picks",
    order: 1,
  },
  {
    slug: "coffee-break",
    nameEs: "Coffee Break",
    nameEn: "Coffee Break",
    order: 2,
  },
  {
    slug: "working-lunch",
    nameEs: "Working Lunch",
    nameEn: "Working Lunch",
    order: 3,
  },
  { slug: "desayunos", nameEs: "Desayunos", nameEn: "Breakfasts", order: 4 },
  { slug: "bebidas", nameEs: "Bebidas", nameEn: "Drinks", order: 5 },
];
type Seccion = (typeof SECCIONES)[number]["slug"];

const IMG_INGREDIENTE = "/images/products/ingredients";
// Los 9 primeros tienen imagen en el front; el resto se pinta con su inicial.
const INGREDIENTES = [
  {
    n: 1,
    nameEs: "Crema de leche",
    nameEn: "Cream",
    image: `${IMG_INGREDIENTE}/crema.png`,
  },
  {
    n: 2,
    nameEs: "Salsa de ajo",
    nameEn: "Garlic sauce",
    image: `${IMG_INGREDIENTE}/salsa-blanca.png`,
  },
  {
    n: 3,
    nameEs: "Cebolla",
    nameEn: "Onion",
    image: `${IMG_INGREDIENTE}/cebolla.png`,
  },
  {
    n: 4,
    nameEs: "Repollo morado",
    nameEn: "Red cabbage",
    image: `${IMG_INGREDIENTE}/repollo-morado.png`,
  },
  {
    n: 5,
    nameEs: "Carne molida",
    nameEn: "Ground beef",
    image: `${IMG_INGREDIENTE}/carne-molida.png`,
  },
  {
    n: 6,
    nameEs: "Perejil",
    nameEn: "Parsley",
    image: `${IMG_INGREDIENTE}/perejil.png`,
  },
  {
    n: 7,
    nameEs: "Arepitas de maíz",
    nameEn: "Corn arepitas",
    image: `${IMG_INGREDIENTE}/tortilla.png`,
  },
  {
    n: 8,
    nameEs: "Jamón de pierna",
    nameEn: "Leg ham",
    image: `${IMG_INGREDIENTE}/jamon.png`,
  },
  {
    n: 9,
    nameEs: "Salsa de la casa",
    nameEn: "House sauce",
    image: `${IMG_INGREDIENTE}/salsa-oscura.png`,
  },
  { n: 10, nameEs: "Queso blanco", nameEn: "White cheese", image: null },
  { n: 11, nameEs: "Huevo", nameEn: "Egg", image: null },
  { n: 12, nameEs: "Aguacate", nameEn: "Avocado", image: null },
  { n: 13, nameEs: "Pollo", nameEn: "Chicken", image: null },
  { n: 14, nameEs: "Harina de trigo", nameEn: "Wheat flour", image: null },
  { n: 15, nameEs: "Mantequilla", nameEn: "Butter", image: null },
  { n: 16, nameEs: "Quinoa", nameEn: "Quinoa", image: null },
  { n: 17, nameEs: "Garbanzos", nameEn: "Chickpeas", image: null },
  { n: 18, nameEs: "Espinaca", nameEn: "Spinach", image: null },
  { n: 19, nameEs: "Piña", nameEn: "Pineapple", image: null },
  { n: 20, nameEs: "Jengibre", nameEn: "Ginger", image: null },
  {
    n: 21,
    nameEs: "Café venezolano",
    nameEn: "Venezuelan coffee",
    image: null,
  },
  { n: 22, nameEs: "Caraotas negras", nameEn: "Black beans", image: null },
  { n: 23, nameEs: "Guayaba", nameEn: "Guava", image: null },
  {
    n: 24,
    nameEs: "Fruta de temporada",
    nameEn: "Seasonal fruit",
    image: null,
  },
  { n: 25, nameEs: "Yogur griego", nameEn: "Greek yogurt", image: null },
  { n: 26, nameEs: "Tomate", nameEn: "Tomato", image: null },
];

interface Nutricion {
  energyKj: number | null;
  calories: number | null;
  fat: number | null;
  saturatedFat: number | null;
  carbohydrates: number | null;
  sugar: number | null;
  fiber: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
}

/** kJ a partir de kcal (1 kcal = 4,184 kJ). */
const nutricion = (n: Omit<Nutricion, "energyKj">): Nutricion => ({
  ...n,
  energyKj: n.calories === null ? null : Math.round(n.calories * 4.184),
});

interface TamanoSeed {
  n: number;
  servings: number;
  price: string;
  isDefault?: boolean;
}

interface ProductoSeed {
  n: number;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  /** Sin tamaños: precio único. Con tamaños: el menor, por coherencia (el catálogo usa los tamaños). */
  basePrice: string;
  image: string | null;
  gallery?: string[];
  sizes?: TamanoSeed[];
  tags?: TagKey[];
  ingredients?: number[];
  nutrition?: Nutricion;
  isFeatured?: boolean;
  isOnSale?: boolean;
  isNew?: boolean;
  secciones: Seccion[];
}

/** Tres tamaños (4, 8 y 12 personas) con IDs `n*10 + 0..2`, como en los datos de ejemplo del front. */
function tamanos(n: number, desde: number, hasta: number): TamanoSeed[] {
  const medio = Math.round(((desde + hasta) / 2) * 100) / 100;
  return [
    { n: n * 10, servings: 4, price: desde.toFixed(2), isDefault: true },
    { n: n * 10 + 1, servings: 8, price: medio.toFixed(2) },
    { n: n * 10 + 2, servings: 12, price: hasta.toFixed(2) },
  ];
}

const IMG = "/images/products";

// El orden del array es el de `SectionItem.order` dentro de cada sección (igual que en el front).
const PRODUCTOS: ProductoSeed[] = [
  {
    n: 15,
    nameEs: "Surtidos de pasapalos para compartir (2 a 15 personas)",
    nameEn: "Shareable finger food assortment (2 to 15 people)",
    descriptionEs:
      "¡Bienvenidos a la mesa! Esta caja está pensada para disfrutar juntos de lo mejor de nuestros sabores: " +
      "arepitas de maíz recién hechas, un cachito de queso doradito y el infaltable acompañamiento de queso blanco " +
      "y jamón de pierna.\nAbran, compartan y disfruten un desayuno lleno de tradición.",
    descriptionEn:
      "Welcome to the table! Freshly made corn arepitas, golden cheese cachitos, white cheese and leg ham to share.",
    basePrice: "22.00",
    image: `${IMG}/gallery/pasapalos-principal.png`,
    gallery: [
      `${IMG}/gallery/pasapalos.png`,
      `${IMG}/gallery/cafe-bolleria.png`,
      `${IMG}/gallery/cafe-croissants.png`,
      `${IMG}/gallery/cafe-panes.png`,
    ],
    // 8 personas = $34,00, el total del Figma.
    sizes: [
      { n: 1, servings: 4, price: "22.00" },
      { n: 2, servings: 6, price: "28.00" },
      { n: 3, servings: 8, price: "34.00", isDefault: true },
      { n: 4, servings: 10, price: "46.00" },
      { n: 5, servings: 12, price: "58.00" },
    ],
    ingredients: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    nutrition: {
      energyKj: 3138,
      calories: 750,
      fat: 31,
      saturatedFat: 12,
      carbohydrates: 93,
      sugar: 11,
      fiber: 12,
      cholesterolMg: 50,
      sodiumMg: 610,
    },
    isFeatured: true,
    secciones: ["recomendados-de-la-semana", "coffee-break", "desayunos"],
  },
  {
    n: 1,
    nameEs: "Surtido: Coffee Break AM",
    nameEn: "Assortment: AM Coffee Break",
    descriptionEs:
      "Mini croissants, pan de guayaba, fruta picada y yogur griego con granola para la reunión de la mañana.",
    descriptionEn:
      "Mini croissants, guava bread, cut fruit and Greek yogurt with granola for the morning meeting.",
    basePrice: "45.00",
    image: `${IMG}/caja-desayuno.png`,
    sizes: tamanos(1, 45, 120),
    tags: ["saludable"],
    ingredients: [14, 15, 23, 24, 25],
    nutrition: nutricion({
      calories: 410,
      fat: 16,
      saturatedFat: 8,
      carbohydrates: 58,
      sugar: 22,
      fiber: 4,
      cholesterolMg: 45,
      sodiumMg: 320,
    }),
    isFeatured: true,
    isNew: true,
    secciones: ["recomendados-de-la-semana", "coffee-break"],
  },
  {
    n: 2,
    nameEs: "Surtido Gluten free (de 4 a 15 personas)",
    nameEn: "Gluten free assortment (4 to 15 people)",
    descriptionEs:
      "Arepitas, tequeños de yuca, frutas y quesos: todo sin gluten y preparado en línea separada.",
    descriptionEn:
      "Arepitas, cassava tequeños, fruit and cheeses: all gluten free, prepared on a separate line.",
    basePrice: "60.00",
    image: `${IMG}/caja-bowl.png`,
    sizes: tamanos(2, 60, 180),
    tags: ["sinGluten", "saludable"],
    ingredients: [7, 10, 24],
    isFeatured: true,
    secciones: ["recomendados-de-la-semana", "coffee-break"],
  },
  {
    n: 3,
    nameEs: "Coffee Break Ejecutivo",
    nameEn: "Executive Coffee Break",
    descriptionEs:
      "Mini sándwiches, bagels y canapés para reuniones de 4 a 15 personas.",
    descriptionEn:
      "Mini sandwiches, bagels and canapés for meetings of 4 to 15 people.",
    basePrice: "85.00",
    image: `${IMG}/coffee-break-box.webp`,
    sizes: tamanos(3, 85, 240),
    ingredients: [8, 10, 14, 26],
    nutrition: nutricion({
      calories: 520,
      fat: 22,
      saturatedFat: 9,
      carbohydrates: 61,
      sugar: 6,
      fiber: 3,
      cholesterolMg: 55,
      sodiumMg: 890,
    }),
    isFeatured: true,
    isOnSale: true,
    secciones: ["coffee-break"],
  },
  {
    n: 4,
    nameEs: "Morning Bite",
    nameEn: "Morning Bite",
    descriptionEs:
      "Croissant, sándwiches, magdalenas, fruta y café para empezar la jornada.",
    descriptionEn:
      "Croissant, sandwiches, muffins, fruit and coffee to start the day.",
    basePrice: "38.00",
    image: `${IMG}/morning-bite.webp`,
    sizes: tamanos(4, 38, 95),
    ingredients: [8, 11, 14, 15],
    isNew: true,
    secciones: ["recomendados-de-la-semana", "desayunos"],
  },
  {
    n: 5,
    nameEs: "Desayuno Keto",
    nameEn: "Keto Breakfast",
    descriptionEs:
      "Huevos, quesos, embutidos y aguacate, sin harinas ni azúcar añadida.",
    descriptionEn:
      "Eggs, cheeses, cold cuts and avocado, with no flour or added sugar.",
    basePrice: "52.00",
    image: null,
    sizes: tamanos(5, 52, 140),
    tags: ["keto", "sinGluten"],
    ingredients: [8, 10, 11, 12],
    nutrition: nutricion({
      calories: 480,
      fat: 38,
      saturatedFat: 14,
      carbohydrates: 6,
      sugar: 2,
      fiber: 5,
      cholesterolMg: 380,
      sodiumMg: 940,
    }),
    secciones: ["desayunos"],
  },
  {
    n: 6,
    nameEs: "Bowl Working Lunch",
    nameEn: "Working Lunch Bowl",
    descriptionEs:
      "Bowls de proteína, granos y vegetales asados para almuerzos de trabajo.",
    descriptionEn:
      "Protein, grain and roasted vegetable bowls for working lunches.",
    basePrice: "70.00",
    image: `${IMG}/caja-bowl.png`,
    sizes: tamanos(6, 70, 210),
    tags: ["saludable"],
    ingredients: [4, 12, 13, 16, 26],
    nutrition: nutricion({
      calories: 560,
      fat: 18,
      saturatedFat: 4,
      carbohydrates: 62,
      sugar: 7,
      fiber: 11,
      cholesterolMg: 70,
      sodiumMg: 640,
    }),
    isFeatured: true,
    secciones: ["recomendados-de-la-semana", "working-lunch"],
  },
  {
    n: 7,
    nameEs: "Working Lunch Vegano",
    nameEn: "Vegan Working Lunch",
    descriptionEs: "Bowls y wraps 100 % vegetales con aderezos de la casa.",
    descriptionEn: "100% plant-based bowls and wraps with house dressings.",
    basePrice: "68.00",
    image: `${IMG}/caja-bowl.png`,
    sizes: tamanos(7, 68, 200),
    tags: ["vegano", "saludable"],
    ingredients: [4, 12, 16, 17, 18],
    isNew: true,
    isOnSale: true,
    secciones: ["working-lunch"],
  },
  {
    n: 8,
    nameEs: "Wraps de pollo y vegetales",
    nameEn: "Chicken and vegetable wraps",
    descriptionEs:
      "Caja de 6 wraps individuales con pollo a la plancha, vegetales frescos y salsa de yogur.",
    descriptionEn:
      "Box of 6 individual wraps with grilled chicken, fresh vegetables and yogurt sauce.",
    basePrice: "55.00",
    image: null,
    ingredients: [13, 14, 25, 26],
    nutrition: nutricion({
      calories: 430,
      fat: 14,
      saturatedFat: 4,
      carbohydrates: 44,
      sugar: 5,
      fiber: 5,
      cholesterolMg: 65,
      sodiumMg: 720,
    }),
    secciones: ["working-lunch"],
  },
  {
    n: 9,
    nameEs: "Bebidas naturales",
    nameEn: "Natural drinks",
    descriptionEs:
      "Jugos de parchita, mango y fresa, sin azúcar añadida, para acompañar cada pedido.",
    descriptionEn:
      "Passion fruit, mango and strawberry juices, no added sugar, to go with every order.",
    basePrice: "18.00",
    image: `${IMG}/bebidas.png`,
    sizes: tamanos(9, 18, 48),
    tags: ["vegano", "saludable", "sinGluten"],
    ingredients: [24],
    secciones: ["recomendados-de-la-semana", "bebidas"],
  },
  {
    n: 10,
    nameEs: "Café de especialidad",
    nameEn: "Specialty coffee",
    descriptionEs:
      "Termos de café venezolano recién colado, con leche vegetal opcional.",
    descriptionEn:
      "Flasks of freshly brewed Venezuelan coffee, with optional plant milk.",
    basePrice: "15.00",
    image: null,
    sizes: tamanos(10, 15, 40),
    tags: ["vegano", "sinGluten", "keto"],
    ingredients: [21],
    nutrition: nutricion({
      calories: 5,
      fat: 0,
      saturatedFat: 0,
      carbohydrates: 1,
      sugar: 0,
      fiber: 0,
      cholesterolMg: 0,
      sodiumMg: 5,
    }),
    isOnSale: true,
    secciones: ["bebidas"],
  },
  {
    n: 11,
    nameEs: "Bollería de la casa",
    nameEn: "House pastries",
    descriptionEs:
      "Croissants, pan de guayaba y cachitos horneados esa misma mañana.",
    descriptionEn:
      "Croissants, guava bread and cachitos baked that same morning.",
    basePrice: "30.00",
    image: null,
    sizes: tamanos(11, 30, 90),
    ingredients: [8, 14, 15, 23],
    secciones: ["coffee-break", "desayunos"],
  },
  {
    n: 12,
    nameEs: "Surtido salado mini",
    nameEn: "Mini savory assortment",
    descriptionEs:
      "Tequeños, mini empanadas y pasapalos salados para reuniones.",
    descriptionEn: "Tequeños, mini empanadas and savory bites for meetings.",
    basePrice: "48.00",
    image: null,
    sizes: tamanos(12, 48, 130),
    tags: ["keto"],
    ingredients: [3, 5, 10, 14],
    nutrition: nutricion({
      calories: 610,
      fat: 34,
      saturatedFat: 13,
      carbohydrates: 55,
      sugar: 3,
      fiber: 2,
      cholesterolMg: 60,
      sodiumMg: 980,
    }),
    secciones: ["coffee-break"],
  },
  {
    n: 13,
    nameEs: "Desayuno criollo",
    nameEn: "Venezuelan breakfast",
    descriptionEs:
      "Arepas rellenas, perico, queso blanco y caraotas para todo el equipo.",
    descriptionEn:
      "Stuffed arepas, scrambled eggs with tomato and onion, white cheese and black beans.",
    basePrice: "42.00",
    image: null,
    sizes: tamanos(13, 42, 110),
    tags: ["sinGluten"],
    ingredients: [3, 7, 10, 11, 22, 26],
    isNew: true,
    secciones: ["desayunos"],
  },
  {
    n: 14,
    nameEs: "Jugos verdes",
    nameEn: "Green juices",
    descriptionEs:
      "Pack de 6: espinaca, piña, apio y jengibre, prensados en frío.",
    descriptionEn:
      "Pack of 6: spinach, pineapple, celery and ginger, cold pressed.",
    basePrice: "20.00",
    image: null,
    tags: ["vegano", "saludable", "keto"],
    ingredients: [18, 19, 20],
    nutrition: nutricion({
      calories: 90,
      fat: 0,
      saturatedFat: 0,
      carbohydrates: 21,
      sugar: 16,
      fiber: 2,
      cholesterolMg: 0,
      sodiumMg: 40,
    }),
    secciones: ["bebidas"],
  },
];

/** Modificadores del café (grupo "Leche" obligatorio: la ficha avisa en lugar de añadir directo). */
const GRUPOS_MODIFICADORES = [
  {
    n: 1,
    productN: 10,
    nameEs: "Leche",
    nameEn: "Milk",
    minSelect: 1,
    maxSelect: 1,
    modifiers: [
      {
        n: 1,
        nameEs: "Leche completa",
        nameEn: "Whole milk",
        price: "0.00",
        isDefault: true,
      },
      {
        n: 2,
        nameEs: "Leche de almendras",
        nameEn: "Almond milk",
        price: "3.00",
      },
      { n: 3, nameEs: "Leche de avena", nameEn: "Oat milk", price: "3.00" },
      { n: 4, nameEs: "Sin leche", nameEn: "No milk", price: "0.00" },
    ],
  },
  {
    n: 2,
    productN: 10,
    nameEs: "Extras",
    nameEn: "Extras",
    minSelect: 0,
    maxSelect: 2,
    modifiers: [
      { n: 5, nameEs: "Papelón", nameEn: "Panela sugar", price: "1.00" },
      { n: 6, nameEs: "Canela", nameEn: "Cinnamon", price: "0.50" },
    ],
  },
];

const COMBOS = [
  {
    n: 1,
    nameEs: "Surtido Reunión de directorio (10 personas)",
    nameEn: "Board meeting assortment (10 people)",
    descriptionEs:
      "Bollería, sándwiches gourmet, fruta, café y jugos para una reunión completa.",
    descriptionEn:
      "Pastries, gourmet sandwiches, fruit, coffee and juices for a full meeting.",
    price: "120.00",
    image: `${IMG}/coffee-break-box.webp`,
    isFeatured: true,
    items: [
      { productN: 11, quantity: 1 },
      { productN: 3, quantity: 1 },
      { productN: 9, quantity: 1 },
      { productN: 10, quantity: 1 },
    ],
    secciones: ["recomendados-de-la-semana", "coffee-break"] as Seccion[],
  },
  {
    n: 2,
    nameEs: "Surtido Desayuno de equipo (6 personas)",
    nameEn: "Team breakfast assortment (6 people)",
    descriptionEs:
      "Desayuno criollo, bollería de la casa y café recién colado para el equipo.",
    descriptionEn:
      "Venezuelan breakfast, house pastries and fresh coffee for the team.",
    price: "85.50",
    image: `${IMG}/morning-bite.webp`,
    isNew: true,
    isOnSale: true,
    items: [
      { productN: 13, quantity: 1 },
      { productN: 11, quantity: 1 },
      { productN: 10, quantity: 1 },
    ],
    secciones: ["desayunos"] as Seccion[],
  },
  {
    n: 3,
    nameEs: "Surtido Working Lunch (8 personas)",
    nameEn: "Working Lunch assortment (8 people)",
    descriptionEs:
      "Bowls, wraps, ensalada y bebidas naturales para almorzar sin salir de la oficina.",
    descriptionEn:
      "Bowls, wraps, salad and natural drinks to have lunch without leaving the office.",
    price: "160.00",
    image: null,
    items: [
      { productN: 6, quantity: 1 },
      { productN: 8, quantity: 1 },
      { productN: 14, quantity: 2 },
    ],
    secciones: ["working-lunch"] as Seccion[],
  },
];

// ============================================
// Helpers
// ============================================

/** Upsert por ID; si ya existe otra fila con la misma clave única (creada a mano), reutiliza su ID. */
async function idExistente(
  buscar: () => Promise<{ id: string } | null>,
  idSeed: string,
): Promise<string> {
  const fila = await buscar();
  return fila?.id ?? idSeed;
}

async function seedTags(): Promise<Record<TagKey, string>> {
  const ids = {} as Record<TagKey, string>;
  for (const [key, tag] of Object.entries(TAGS) as [
    TagKey,
    (typeof TAGS)[TagKey],
  ][]) {
    const id = await idExistente(
      () => prisma.tag.findUnique({ where: { nameEs: tag.nameEs } }),
      tag.id,
    );
    await prisma.tag.upsert({
      where: { id },
      create: { id, nameEs: tag.nameEs, nameEn: tag.nameEn },
      update: {},
    });
    ids[key] = id;
  }
  return ids;
}

async function seedSecciones(): Promise<Record<Seccion, string>> {
  const ids = {} as Record<Seccion, string>;
  for (const s of SECCIONES) {
    const row = await prisma.section.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        nameEs: s.nameEs,
        nameEn: s.nameEn,
        order: s.order,
      },
      update: {},
    });
    ids[s.slug] = row.id;
  }
  return ids;
}

async function seedIngredientes(): Promise<Map<number, string>> {
  const ids = new Map<number, string>();
  for (const ing of INGREDIENTES) {
    const id = await idExistente(
      () => prisma.ingredient.findUnique({ where: { nameEs: ing.nameEs } }),
      ingredientId(ing.n),
    );
    await prisma.ingredient.upsert({
      where: { id },
      create: { id, nameEs: ing.nameEs, nameEn: ing.nameEn, image: ing.image },
      update: {},
    });
    ids.set(ing.n, id);
  }
  return ids;
}

async function seedProductos(
  tags: Record<TagKey, string>,
  secciones: Record<Seccion, string>,
  ingredientes: Map<number, string>,
) {
  const orden = new Map<Seccion, number>();
  const siguiente = (s: Seccion) => {
    const n = (orden.get(s) ?? 0) + 1;
    orden.set(s, n);
    return n;
  };

  for (const p of PRODUCTOS) {
    const id = productId(p.n);
    const n = p.nutrition;
    const datos = {
      nameEs: p.nameEs,
      nameEn: p.nameEn,
      descriptionEs: p.descriptionEs,
      descriptionEn: p.descriptionEn,
      basePrice: p.basePrice,
      image: p.image,
      isActive: true,
      isFeatured: p.isFeatured ?? false,
      isOnSale: p.isOnSale ?? false,
      energyKj: n?.energyKj ?? null,
      calories: n?.calories ?? null,
      fat: n?.fat ?? null,
      saturatedFat: n?.saturatedFat ?? null,
      carbohydrates: n?.carbohydrates ?? null,
      sugar: n?.sugar ?? null,
      fiber: n?.fiber ?? null,
      cholesterolMg: n?.cholesterolMg ?? null,
      sodiumMg: n?.sodiumMg ?? null,
      // "Nuevo" = creado en los últimos 30 días.
      createdAt: p.isNew ? new Date() : CREADO_ANTES,
    };
    await prisma.product.upsert({
      where: { id },
      create: { id, ...datos },
      update: datos,
    });

    for (const [i, t] of (p.sizes ?? []).entries()) {
      const size = {
        productId: id,
        nameEs: `${t.servings} personas`,
        nameEn: `${t.servings} people`,
        price: t.price,
        servings: t.servings,
        sortOrder: i,
        isDefault: t.isDefault ?? false,
        isActive: true,
      };
      await prisma.productSize.upsert({
        where: { id: sizeId(t.n) },
        create: { id: sizeId(t.n), ...size },
        update: size,
      });
    }

    await prisma.productImage.deleteMany({ where: { productId: id } });
    if (p.gallery?.length) {
      await prisma.productImage.createMany({
        data: p.gallery.map((url, i) => ({
          productId: id,
          url,
          sortOrder: i + 1,
        })),
      });
    }

    await prisma.productIngredient.deleteMany({ where: { productId: id } });
    if (p.ingredients?.length) {
      await prisma.productIngredient.createMany({
        data: p.ingredients.map((ing, i) => ({
          productId: id,
          ingredientId: ingredientes.get(ing)!,
          sortOrder: i,
        })),
      });
    }

    await prisma.productTag.deleteMany({ where: { productId: id } });
    if (p.tags?.length) {
      await prisma.productTag.createMany({
        data: p.tags.map((t) => ({ productId: id, tagId: tags[t] })),
      });
    }

    for (const s of p.secciones) {
      const sectionId = secciones[s];
      const order = siguiente(s);
      await prisma.sectionItem.upsert({
        where: { sectionId_productId: { sectionId, productId: id } },
        create: { sectionId, productId: id, order },
        update: { order },
      });
    }
  }

  for (const g of GRUPOS_MODIFICADORES) {
    const grupo = {
      productId: productId(g.productN),
      nameEs: g.nameEs,
      nameEn: g.nameEn,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      sortOrder: g.n,
    };
    await prisma.productModifierGroup.upsert({
      where: { id: groupId(g.n) },
      create: { id: groupId(g.n), ...grupo },
      update: grupo,
    });
    for (const [i, m] of g.modifiers.entries()) {
      const mod = {
        groupId: groupId(g.n),
        nameEs: m.nameEs,
        nameEn: m.nameEn,
        priceAdjustment: m.price,
        isDefault: m.isDefault ?? false,
        isActive: true,
        sortOrder: i,
      };
      await prisma.productModifier.upsert({
        where: { id: modifierId(m.n) },
        create: { id: modifierId(m.n), ...mod },
        update: mod,
      });
    }
  }

  for (const c of COMBOS) {
    const id = comboId(c.n);
    const datos = {
      nameEs: c.nameEs,
      nameEn: c.nameEn,
      descriptionEs: c.descriptionEs,
      descriptionEn: c.descriptionEn,
      price: c.price,
      image: c.image,
      isActive: true,
      isFeatured: c.isFeatured ?? false,
      isOnSale: c.isOnSale ?? false,
      createdAt: c.isNew ? new Date() : CREADO_ANTES,
    };
    await prisma.combo.upsert({
      where: { id },
      create: { id, ...datos },
      update: datos,
    });

    await prisma.comboItem.deleteMany({ where: { comboId: id } });
    await prisma.comboItem.createMany({
      data: c.items.map((item, i) => ({
        comboId: id,
        productId: productId(item.productN),
        quantity: item.quantity,
        sortOrder: i,
      })),
    });

    for (const s of c.secciones) {
      const sectionId = secciones[s];
      const order = siguiente(s);
      await prisma.sectionItem.upsert({
        where: { sectionId_comboId: { sectionId, comboId: id } },
        create: { sectionId, comboId: id, order },
        update: { order },
      });
    }
  }

  // Quita de las secciones del seed los productos y combos del seed que ya no figuran en ellas.
  for (const s of SECCIONES) {
    await prisma.sectionItem.deleteMany({
      where: {
        sectionId: secciones[s.slug],
        OR: [
          {
            productId: {
              in: PRODUCTOS.map((p) => productId(p.n)),
              notIn: PRODUCTOS.filter((p) => p.secciones.includes(s.slug)).map(
                (p) => productId(p.n),
              ),
            },
          },
          {
            comboId: {
              in: COMBOS.map((c) => comboId(c.n)),
              notIn: COMBOS.filter((c) => c.secciones.includes(s.slug)).map(
                (c) => comboId(c.n),
              ),
            },
          },
        ],
      },
    });
  }
}

// ============================================
// Empresa, usuarios y carrito demo
// ============================================

const EMPRESA_ID = "c0a10000-0000-4000-8000-000000000001";
const SEDE_ID = "c0a20000-0000-4000-8000-000000000001";
const DEPARTAMENTO_ID = "c0a30000-0000-4000-8000-000000000001";
const DIRECCION_ID = "c0a40000-0000-4000-8000-000000000001";

const USUARIOS_DEMO = [
  {
    email: "admin.demo@ofibites.example.com",
    name: "Ana Demo (admin)",
    role: CompanyRole.COMPANY_ADMIN,
  },
  {
    email: "compras.demo@ofibites.example.com",
    name: "Carlos Demo (compras)",
    role: CompanyRole.COMPANY_BUYER,
  },
];

/** Crea el usuario en Supabase Auth (confirmado) o, si ya existe, le pone la contraseña y devuelve su ID. */
async function usuarioAuth(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const creado = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (creado.data.user) return creado.data.user.id;

  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const existente = data.users.find((u) => u.email?.toLowerCase() === email);
    if (existente) {
      const { error: errorUpdate } = await supabase.auth.admin.updateUserById(
        existente.id,
        { password, email_confirm: true },
      );
      if (errorUpdate) throw errorUpdate;
      return existente.id;
    }
    if (data.users.length < 1000) break;
  }
  throw creado.error ?? new Error(`No se pudo crear el usuario ${email}`);
}

async function seedEmpresaDemo(password: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para crear los usuarios demo",
    );
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const empresa = {
    legalName: "Kromaticos Demo C.A.",
    fiscalName: "Kromaticos Demo C.A.",
    email: "facturacion.demo@ofibites.example.com",
    phone: "+58 212 555 0100",
    fiscalAddress: "Av. Principal de Las Mercedes, Torre Demo, piso 5, Caracas",
    creditDays: 15,
    isActive: true,
  };
  await prisma.company.upsert({
    where: { id: EMPRESA_ID },
    create: { id: EMPRESA_ID, taxId: "J-50000000-1", ...empresa },
    update: empresa,
  });
  await prisma.branch.upsert({
    where: { id: SEDE_ID },
    create: { id: SEDE_ID, companyId: EMPRESA_ID, name: "Sede Las Mercedes" },
    update: { name: "Sede Las Mercedes", isActive: true },
  });
  await prisma.department.upsert({
    where: { id: DEPARTAMENTO_ID },
    create: { id: DEPARTAMENTO_ID, companyId: EMPRESA_ID, name: "Operaciones" },
    update: { name: "Operaciones", isActive: true },
  });
  const direccion = {
    companyId: EMPRESA_ID,
    label: "Oficina principal",
    line1: "Av. Principal de Las Mercedes, Torre Demo",
    line2: "Piso 5, oficina 5-B",
    reference: "Frente a la plaza",
    city: "Caracas",
    state: "Distrito Capital",
    country: "Venezuela",
    zip: "1060",
    isBilling: true,
    isShipping: true,
  };
  await prisma.companyAddress.upsert({
    where: { id: DIRECCION_ID },
    create: { id: DIRECCION_ID, ...direccion },
    update: direccion,
  });

  const usuarios: string[] = [];
  for (const u of USUARIOS_DEMO) {
    const authId = await usuarioAuth(supabase, u.email, password);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, authId, name: u.name, role: Role.CLIENT },
      update: { authId, name: u.name, role: Role.CLIENT, isActive: true },
    });
    const miembro = {
      role: u.role,
      branchId: SEDE_ID,
      departmentId: DEPARTAMENTO_ID,
      position:
        u.role === CompanyRole.COMPANY_ADMIN
          ? "Gerente de oficina"
          : "Analista de compras",
      canPayInvoices: u.role === CompanyRole.COMPANY_ADMIN,
      isActive: true,
    };
    await prisma.companyMember.upsert({
      where: { userId_companyId: { userId: user.id, companyId: EMPRESA_ID } },
      create: { userId: user.id, companyId: EMPRESA_ID, ...miembro },
      update: miembro,
    });
    usuarios.push(user.id);
  }

  // Carrito con un poco de todo: tamaño, modificadores, combo y producto sin tamaños.
  const cart = await prisma.cart.upsert({
    where: { companyId: EMPRESA_ID },
    create: { companyId: EMPRESA_ID },
    update: {},
  });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  const [admin, compras] = usuarios;
  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: productId(15),
      productSizeId: sizeId(3),
      quantity: 1,
      addedById: admin,
    },
  });
  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: productId(10),
      productSizeId: sizeId(101),
      quantity: 2,
      addedById: compras,
      modifiers: {
        create: [{ modifierId: modifierId(2) }, { modifierId: modifierId(6) }],
      },
    },
  });
  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: productId(11),
      comboId: comboId(1),
      quantity: 1,
      addedById: compras,
    },
  });
  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: productId(8),
      quantity: 3,
      addedById: admin,
    },
  });

  await seedPedidosDemo(admin, compras);
}

const pedidoId = (n: number) => `0de10000-0000-4000-8000-${pad(n)}`;

/** Día de Caracas (UTC-4 fijo) desplazado `dias`, como medianoche UTC (así se guardan las columnas `@db.Date`). */
function fechaCaracas(dias: number): Date {
  const caracas = new Date(Date.now() - 4 * 60 * 60 * 1000 + dias * DIA_MS);
  return new Date(
    Date.UTC(
      caracas.getUTCFullYear(),
      caracas.getUTCMonth(),
      caracas.getUTCDate(),
    ),
  );
}

interface LineaPedido {
  productN: number;
  sizeN?: number;
  comboN?: number;
  quantity: number;
  unitPrice: number;
  modifiers?: { n: number; price: number }[];
}

/**
 * Historial de pedidos de la empresa demo para el dashboard: uno en camino, uno confirmado, tres entregados y uno
 * cancelado. Se insertan con su estado final (es historial, no pasan por `OrderStateMachine`); los precios son los
 * de los tamaños y modificadores del seed.
 */
async function seedPedidosDemo(admin: string, compras: string) {
  const pedidos: {
    n: number;
    status: "IN_TRANSIT" | "CONFIRMED" | "DELIVERED" | "CANCELLED";
    creadoHaceDias: number;
    entregaEnDias: number;
    hora: string;
    creadoPor: string;
    lineas: LineaPedido[];
  }[] = [
    {
      n: 1,
      status: "IN_TRANSIT",
      creadoHaceDias: 1,
      entregaEnDias: 0,
      hora: "10:30",
      creadoPor: compras,
      lineas: [{ productN: 15, sizeN: 5, quantity: 2, unitPrice: 58 }],
    },
    {
      n: 2,
      status: "CONFIRMED",
      creadoHaceDias: 0,
      entregaEnDias: 1,
      hora: "08:00",
      creadoPor: compras,
      lineas: [{ productN: 11, comboN: 1, quantity: 1, unitPrice: 120 }],
    },
    {
      n: 3,
      status: "DELIVERED",
      creadoHaceDias: 4,
      entregaEnDias: -3,
      hora: "09:00",
      creadoPor: admin,
      lineas: [
        { productN: 3, sizeN: 31, quantity: 1, unitPrice: 162.5 },
        {
          productN: 10,
          sizeN: 101,
          quantity: 1,
          unitPrice: 30.5,
          modifiers: [{ n: 2, price: 3 }],
        },
      ],
    },
    {
      n: 4,
      status: "DELIVERED",
      creadoHaceDias: 8,
      entregaEnDias: -7,
      hora: "12:30",
      creadoPor: compras,
      lineas: [{ productN: 6, sizeN: 62, quantity: 1, unitPrice: 210 }],
    },
    {
      n: 5,
      status: "DELIVERED",
      creadoHaceDias: 15,
      entregaEnDias: -14,
      hora: "08:30",
      creadoPor: admin,
      lineas: [{ productN: 13, sizeN: 131, quantity: 2, unitPrice: 76 }],
    },
    {
      n: 6,
      status: "CANCELLED",
      creadoHaceDias: 21,
      entregaEnDias: -20,
      hora: "09:30",
      creadoPor: compras,
      lineas: [{ productN: 4, sizeN: 40, quantity: 1, unitPrice: 38 }],
    },
  ];

  for (const p of pedidos) {
    const id = pedidoId(p.n);
    const total = p.lineas.reduce(
      (suma, l) => suma + l.unitPrice * l.quantity,
      0,
    );
    const datos = {
      companyId: EMPRESA_ID,
      branchId: SEDE_ID,
      departmentId: DEPARTAMENTO_ID,
      userId: p.creadoPor,
      createdById: p.creadoPor,
      deliveryAddressId: DIRECCION_ID,
      deliveryDate: fechaCaracas(p.entregaEnDias),
      deliveryTime: p.hora,
      status: p.status,
      subtotal: total.toFixed(2),
      discount: "0.00",
      total: total.toFixed(2),
      createdAt: new Date(Date.now() - p.creadoHaceDias * DIA_MS),
    };
    await prisma.order.upsert({
      where: { id },
      create: { id, ...datos },
      update: datos,
    });
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    for (const l of p.lineas) {
      await prisma.orderItem.create({
        data: {
          orderId: id,
          productId: productId(l.productN),
          productSizeId: l.sizeN ? sizeId(l.sizeN) : null,
          comboId: l.comboN ? comboId(l.comboN) : null,
          quantity: l.quantity,
          unitPrice: l.unitPrice.toFixed(2),
          subtotal: (l.unitPrice * l.quantity).toFixed(2),
          modifiers: {
            create: (l.modifiers ?? []).map((m) => ({
              modifierId: modifierId(m.n),
              priceAdjustment: m.price.toFixed(2),
            })),
          },
        },
      });
    }
  }
}

// Banners del carrusel del dashboard (`section` "home-carousel"), con las fotos que ya tiene el front.
const BANNERS = [
  {
    n: 1,
    title: "Coffee Break Ejecutivo",
    imageUrl: `${IMG}/coffee-break-box.webp`,
    altText: "Caja de coffee break con bagels, sándwiches y canapés",
    linkUrl: `/producto/${productId(3)}`,
  },
  {
    n: 2,
    title: "Morning Bite",
    imageUrl: `${IMG}/morning-bite.webp`,
    altText:
      "Caja Morning Bite con croissant, sándwiches, magdalenas, fruta y café",
    linkUrl: `/producto/${productId(4)}`,
  },
  {
    n: 3,
    title: "Bebidas naturales",
    imageUrl: `${IMG}/bebidas.png`,
    altText: "Tres botellas de jugo natural",
    linkUrl: "/ordenar?categoria=bebidas",
  },
];

async function seedBanners() {
  for (const b of BANNERS) {
    const id = `b4a10000-0000-4000-8000-${pad(b.n)}`;
    const datos = {
      title: b.title,
      imageUrl: b.imageUrl,
      altText: b.altText,
      linkUrl: b.linkUrl,
      section: "home-carousel",
      order: b.n,
      isActive: true,
    };
    await prisma.banner.upsert({
      where: { id },
      create: { id, ...datos },
      update: datos,
    });
  }
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").host;
  if (
    process.env.NODE_ENV === "production" ||
    process.env.SEED_CONFIRM !== host
  )
    throw new Error(
      `Seed abortado: no corre con NODE_ENV=production y exige confirmar la base de datos (host detectado: "${host}"). ` +
        `Ejecuta: SEED_CONFIRM=${host} yarn seed`,
    );
  const tags = await seedTags();
  const secciones = await seedSecciones();
  const ingredientes = await seedIngredientes();
  await seedProductos(tags, secciones, ingredientes);
  await seedBanners();
  console.log(
    `Catálogo: ${PRODUCTOS.length} productos, ${COMBOS.length} combos, ${SECCIONES.length} secciones.`,
  );

  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) {
    console.log(
      "Sin SEED_DEMO_PASSWORD: no se crean la empresa, los usuarios, el carrito ni los pedidos demo.",
    );
    return;
  }
  await seedEmpresaDemo(password);
  console.log(
    `Empresa demo ${EMPRESA_ID} (header X-Company-Id) con carrito de 4 ítems y 6 pedidos. Usuarios:`,
  );
  for (const u of USUARIOS_DEMO) console.log(`  ${u.email} (${u.role})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
