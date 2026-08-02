// menus.js — Menus, configuracion por restaurante, system prompt y esquema de tools.
// Precios en USD, tomados del menu publico de Tijuana's Bar & Grill (tijuanasbarandgrill.com).
// Nota: el sitio no lista bebidas ni postres; el upsell ofrece una botana.
// Para items con variantes (pollo/res/carnitas), se usa el precio base publicado.

const RESTAURANTS = {
  tijuanas: {
    id: "tijuanas",
    name: "Tijuana's Bar & Grill",
    currency: "usd",
    greeting: "¡Hola! Soy Nacho, de Tijuana's Bar & Grill. ¿Cuál es su orden?",
    upsell: {
      categories: ["botanas"],
      prompt: "¿Te agrego una botana para empezar, como Guacamole (Andale) o unos Tijuana Nachos?"
    },
    menu: [
      // --- SOPAS ---
      { id: "tj1_caldo_ranchero",   name: "Caldo Ranchero",                 keywords: ["caldo ranchero", "ranchero"], price: 7.50,  category: "sopas" },
      { id: "tj2_caldo_tlalpeno",   name: "Caldo Tlalpeño",                 keywords: ["caldo tlalpeno", "tlalpeno"], price: 8.00,  category: "sopas" },
      { id: "tj3_tlalpeno_camaron", name: "Caldo Tlalpeño con Camarón",     keywords: ["tlalpeno con camaron", "caldo camaron"], price: 9.00,  category: "sopas" },
      { id: "tj4_crema_azteca",     name: "Crema Azteca",                   keywords: ["crema azteca", "azteca"], price: 9.00,  category: "sopas" },
      // --- ENSALADAS ---
      { id: "tj5_la_nortena",       name: "Ensalada La Norteña",            keywords: ["la nortena", "nortena"], price: 12.00, category: "ensaladas" },
      { id: "tj6_de_sol_a_sol",     name: "Ensalada De Sol a Sol",          keywords: ["de sol a sol", "sol a sol"], price: 12.00, category: "ensaladas" },
      { id: "tj7_la_frontera",      name: "Ensalada La Frontera",           keywords: ["la frontera", "frontera"], price: 15.00, category: "ensaladas" },
      { id: "tj8_caesar",           name: "TJ Caesar Salad",                keywords: ["caesar", "cesar", "ensalada caesar"], price: 10.00, category: "ensaladas" },
      // --- BOTANAS ---
      { id: "tj9_tj_dip",           name: "Tijuana's Dip",                  keywords: ["tijuanas dip", "dip"], price: 6.50,  category: "botanas" },
      { id: "tj10_a_la_charola",    name: "A la Charola",                   keywords: ["a la charola", "charola"], price: 8.00,  category: "botanas" },
      { id: "tj11_quesadilla_azteca", name: "Quesadilla Azteca",           keywords: ["quesadilla azteca"], price: 7.00,  category: "botanas" },
      { id: "tj12_nachos",          name: "Tijuana Nachos",                 keywords: ["tijuana nachos", "nachos"], price: 15.00, category: "botanas" },
      { id: "tj13_nachos_supreme",  name: "Tijuana Nachos Supreme",         keywords: ["nachos supreme"], price: 16.00, category: "botanas" },
      { id: "tj14_carnitas_baja",   name: "Carnitas al estilo Baja",        keywords: ["carnitas baja", "carnitas al estilo baja"], price: 14.00, category: "botanas" },
      { id: "tj15_mexican_wings",   name: "Mexican Wings",                  keywords: ["mexican wings", "alitas", "wings", "alas"], price: 15.00, category: "botanas" },
      { id: "tj16_andale",          name: "Andale (guacamole/refritos)",    keywords: ["andale", "guacamole", "guaca"], price: 9.00,  category: "botanas" },
      { id: "tj17_ceviche",         name: "Tijuana Ceviche",                keywords: ["tijuana ceviche", "ceviche"], price: 13.00, category: "botanas" },
      { id: "tj18_ceviche_campechana", name: "Ceviche a la Campechana",     keywords: ["ceviche campechana", "campechana"], price: 15.00, category: "botanas" },
      { id: "tj19_nuggets_dorado",  name: "Nuggets de Dorado",              keywords: ["nuggets de dorado", "nuggets dorado"], price: 14.00, category: "botanas" },
      { id: "tj20_shrimp_moctezuma", name: "Shrimp Moctezuma",              keywords: ["shrimp moctezuma", "camarones moctezuma", "moctezuma"], price: 19.00, category: "botanas" },
      { id: "tj21_shrimp_diabla",   name: "Shrimp a la Diabla",             keywords: ["shrimp a la diabla", "camarones a la diabla", "diabla"], price: 18.00, category: "botanas" },
      { id: "tj22_flautas",         name: "Flautas (2 personas)",           keywords: ["flautas"], price: 15.00, category: "botanas" },
      { id: "tj23_fiesta_mexicana", name: "Fiesta Mexicana",                keywords: ["fiesta mexicana"], price: 20.00, category: "botanas" },
      // --- TACOS ---
      { id: "tj24_charras",         name: "Charras (2 tacos)",              keywords: ["charras"], price: 9.50,  category: "tacos" },
      { id: "tj25_charras_fajitas", name: "Charras de Fajitas",             keywords: ["charras de fajitas", "charras fajitas"], price: 12.00, category: "tacos" },
      { id: "tj26_charras_veg",     name: "Charras Vegetarianas",           keywords: ["charras vegetarianas"], price: 10.00, category: "tacos" },
      { id: "tj27_tacos_pastor",    name: "Tacos al Pastor (3)",            keywords: ["tacos al pastor", "taco al pastor", "al pastor", "pastor"], price: 12.00, category: "tacos" },
      { id: "tj28_tacos_vallarta",  name: "Tacos Vallarta (2)",             keywords: ["tacos vallarta", "vallarta"], price: 14.00, category: "tacos" },
      { id: "tj29_tacos_pescado",   name: "Tacos de Pescado (2)",           keywords: ["tacos de pescado", "taco de pescado", "pescado"], price: 14.00, category: "tacos" },
      { id: "tj30_tostadas_california", name: "Tostadas California",        keywords: ["tostadas california", "tostadas"], price: 11.00, category: "tacos" },
      // --- QUESADILLAS ---
      { id: "tj31_quesadilla_tj",   name: "Quesadilla Tijuana",             keywords: ["quesadilla tijuana"], price: 15.00, category: "quesadillas" },
      { id: "tj32_quesadilla_supreme", name: "Quesadilla Tijuana Supreme",  keywords: ["quesadilla tijuana supreme", "quesadilla supreme"], price: 17.00, category: "quesadillas" },
      { id: "tj33_la_gringa",       name: "La Gringa",                      keywords: ["la gringa", "gringa"], price: 14.00, category: "quesadillas" },
      { id: "tj34_quesadilla_veg",  name: "Quesadilla Vegetariana",         keywords: ["quesadilla vegetariana"], price: 14.95, category: "quesadillas" },
      { id: "tj35_cuernavaca",      name: "Cuernavaca (quesadilla churrasco)", keywords: ["cuernavaca"], price: 22.00, category: "quesadillas" },
      { id: "tj36_martijuana",      name: "Martijuana (quesadilla camarones)", keywords: ["martijuana"], price: 20.00, category: "quesadillas" },
      // --- BURRITOS ---
      { id: "tj37_gordo_burrito",   name: "El \"Gordo\" Burrito",           keywords: ["gordo burrito", "el gordo"], price: 15.00, category: "burritos" },
      { id: "tj38_tijuana_burrito", name: "Tijuana Burrito",                keywords: ["tijuana burrito", "burrito tijuana"], price: 16.00, category: "burritos" },
      { id: "tj39_burrito_veg",     name: "Burrito Vegetariano",            keywords: ["burrito vegetariano"], price: 13.00, category: "burritos" },
      { id: "tj40_borimex_burrito", name: "El \"Bori-Mex\" Burrito",        keywords: ["bori-mex", "bori mex", "borimex"], price: 18.00, category: "burritos" },
      { id: "tj41_mexican_wrap",    name: "Mexican Wrap",                   keywords: ["mexican wrap", "wrap"], price: 22.00, category: "burritos" },
      // --- ENCHILADAS ---
      { id: "tj42_ench_rojas",      name: "Enchiladas Rojas",               keywords: ["enchiladas rojas"], price: 16.00, category: "enchiladas" },
      { id: "tj43_ench_suizas",     name: "Enchiladas Suizas",              keywords: ["enchiladas suizas"], price: 16.00, category: "enchiladas" },
      { id: "tj44_ench_mole",       name: "Enchiladas de Mole Poblano",     keywords: ["enchiladas de mole", "mole poblano", "enchiladas mole"], price: 18.00, category: "enchiladas" },
      { id: "tj45_ench_veg",        name: "Enchiladas Vegetarianas",        keywords: ["enchiladas vegetarianas"], price: 16.00, category: "enchiladas" },
      { id: "tj46_ench_fajitas",    name: "Enchiladas de Fajitas",          keywords: ["enchiladas de fajitas"], price: 18.00, category: "enchiladas" },
      { id: "tj47_ench_filete",     name: "Enchiladas de Filete",           keywords: ["enchiladas de filete"], price: 20.00, category: "enchiladas" },
      { id: "tj48_ench_shrimp",     name: "Shrimp Enchiladas",              keywords: ["shrimp enchiladas", "enchiladas de camarones", "enchiladas camarones"], price: 20.00, category: "enchiladas" },
      // --- FAJITAS ---
      { id: "tj49_tjs_fajitas",     name: "T.J.'s Fajitas (filete mignon)", keywords: ["tjs fajitas", "t.j.'s fajitas", "fajitas filete"], price: 28.00, category: "fajitas" },
      { id: "tj50_fajitas_trad",    name: "Fajitas Tradicionales",          keywords: ["fajitas tradicionales", "fajitas"], price: 24.00, category: "fajitas" },
      { id: "tj51_el_volcan",       name: "El Volcán (fajitas mixtas)",     keywords: ["el volcan", "volcan"], price: 28.00, category: "fajitas" },
      { id: "tj52_puntas_filete",   name: "Puntas de Filete al Albañil",    keywords: ["puntas de filete", "al albanil", "puntas"], price: 24.00, category: "fajitas" },
      { id: "tj53_shrimp_fajitas",  name: "Shrimp Fajitas",                 keywords: ["shrimp fajitas", "fajitas de camarones", "fajitas camarones"], price: 26.00, category: "fajitas" },
      { id: "tj54_fajitas_veg",     name: "Fajitas Vegetarianas",           keywords: ["fajitas vegetarianas"], price: 21.00, category: "fajitas" },
      // --- ESPECIALIDADES DE LA CASA ---
      { id: "tj55_pechuga_monterey", name: "Pechuga Monterey",              keywords: ["pechuga monterey"], price: 19.00, category: "especialidades" },
      { id: "tj56_la_margarita",    name: "La Margarita (pechuga de pollo)", keywords: ["la margarita", "margarita"], price: 20.00, category: "especialidades" },
      { id: "tj57_pechuga_chipotle", name: "Pechuga al Chipotle",           keywords: ["pechuga al chipotle", "pechuga chipotle"], price: 20.00, category: "especialidades" },
      { id: "tj58_pechuga_mole",    name: "Pechuga al Mole",                keywords: ["pechuga al mole", "pechuga mole"], price: 24.00, category: "especialidades" },
      { id: "tj59_sopes_tijuana",   name: "Sopes Tijuana",                  keywords: ["sopes tijuana", "sopes"], price: 15.00, category: "especialidades" },
      { id: "tj60_sopes_filet",     name: "Sopes de Filet Mignon",          keywords: ["sopes de filet", "sopes filet mignon"], price: 22.00, category: "especialidades" },
      { id: "tj61_lasagna",         name: "Lasagna Mexicana",               keywords: ["lasagna mexicana", "lasagna", "lasana"], price: 19.00, category: "especialidades" },
      { id: "tj62_trijuanas",       name: "Tri-Juana's (combinación)",      keywords: ["tri-juanas", "trijuanas", "tri juanas"], price: 22.00, category: "especialidades" },
      { id: "tj63_carnitas_tlax",   name: "Carnitas a la Tlaxcalteca",      keywords: ["carnitas a la tlaxcalteca", "tlaxcalteca"], price: 25.00, category: "especialidades" },
      { id: "tj64_veggie_mahi",     name: "Tijuana's Veggie Mahi",          keywords: ["veggie mahi", "mahi"], price: 27.00, category: "especialidades" },
      { id: "tj65_acapulco",        name: "Acapulco (dorado al chipotle)",  keywords: ["acapulco"], price: 27.00, category: "especialidades" },
      { id: "tj66_chilangos_shrimp", name: "Chilangos Shrimp",              keywords: ["chilangos shrimp", "camarones chilangos", "chilangos"], price: 28.00, category: "especialidades" },
      { id: "tj67_cancun_shrimp",   name: "Cancún Shrimp",                  keywords: ["cancun shrimp", "camarones cancun", "cancun"], price: 28.00, category: "especialidades" },
      { id: "tj68_tampiquena",      name: "Tampiqueña (churrasco)",         keywords: ["tampiquena"], price: 28.00, category: "especialidades" },
      { id: "tj69_pelangocha",      name: "La Pelangocha (2 personas)",     keywords: ["la pelangocha", "pelangocha"], price: 36.00, category: "especialidades" },
      // --- CHAPARRITOS ---
      { id: "tj70_quesadillita",    name: "Quesadillita de pollo",          keywords: ["quesadillita", "quesadillita de pollo"], price: 7.00, category: "chaparritos" },
      { id: "tj71_mini_burritos",   name: "Mini burritos de res o pollo",   keywords: ["mini burritos", "mini burrito"], price: 9.00, category: "chaparritos" },
      { id: "tj72_deditos_pollo",   name: "Deditos de pollo con papas",     keywords: ["deditos de pollo", "deditos", "chicken fingers"], price: 9.00, category: "chaparritos" },
      { id: "tj73_arroz_pollo",     name: "Arroz, pollo a la mexicana y amarillos", keywords: ["arroz pollo", "arroz con pollo"], price: 8.00, category: "chaparritos" }
    ]
  }
};

function getRestaurant(id) {
  return RESTAURANTS[(id || "").toLowerCase()] || RESTAURANTS.tijuanas;
}

function menuLine(item) {
  return `${item.id} | ${item.name} | $${item.price.toFixed(2)}`;
}

function systemPrompt(restaurant) {
  const menuText = restaurant.menu.map(menuLine).join("\n");
  const upsell = restaurant.upsell
    ? `Ofrece una vez una botana para empezar (upsell).`
    : `Ofrece SIEMPRE bebida y postre (upsell) una sola vez.`;
  return [
    `Te llamas Nacho y eres el asistente de ordenes de ${restaurant.name} en Puerto Rico. Hablas espanol, calido y breve.`,
    `Al saludar por primera vez preséntate exactamente así: "Hola, soy Nacho, ¿cuál es su orden?". Luego toma el pedido y confirma cada item. ${upsell}`,
    `Calcula el total y pide confirmacion. Usa las herramientas para modificar el carrito y cobrar.`,
    `No inventes platos: usa solo el MENU. Internamente usa el item_id exacto de la primera columna,`,
    `pero NUNCA muestres el item_id ni codigos internos al cliente: menciona solo el nombre del plato.`,
    `No uses formato Markdown ni enlaces entre corchetes; escribe la URL de pago tal cual, en texto plano.`,
    `Saluda solo la primera vez; no repitas el saludo en cada mensaje.`,
    `Antes de cobrar, pregunta SIEMPRE si la orden es 'para llevar' o 'para recoger' y registra la respuesta con set_fulfillment; inclúyela en el resumen.`,
    `Cuando el cliente confirme, usa create_payment para generar el enlace de pago y luego place_order.`,
    ``,
    `MENU (item_id | nombre | precio):`,
    menuText
  ].join("\n");
}

const TOOLS = [
  { name: "add_item", description: "Agrega un item al pedido actual.",
    parameters: { type: "object", properties: {
      item_id: { type: "string", description: "id del item del MENU" },
      qty: { type: "integer", description: "cantidad", minimum: 1 },
      size: { type: "string", description: "tamano/variante opcional" },
      notes: { type: "string", description: "notas opcionales" }
    }, required: ["item_id", "qty"] } },
  { name: "remove_item", description: "Quita un item del pedido por su item_id.",
    parameters: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"] } },
  { name: "get_order", description: "Devuelve el pedido actual y el total.",
    parameters: { type: "object", properties: {} } },
  { name: "set_fulfillment", description: "Registra si la orden es para llevar o para recoger.",
    parameters: { type: "object", properties: { type: { type: "string", enum: ["para llevar", "para recoger"] } }, required: ["type"] } },
  { name: "create_payment", description: "Genera un enlace de pago (Stripe) por el total del pedido.",
    parameters: { type: "object", properties: {} } },
  { name: "place_order", description: "Confirma el pedido y lo envia a la cocina.",
    parameters: { type: "object", properties: {} } }
];

module.exports = { RESTAURANTS, getRestaurant, systemPrompt, TOOLS };
