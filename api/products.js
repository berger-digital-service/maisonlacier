import { db, json, requireMethod } from './_lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  try {
    const [products, inventory] = await Promise.all([
      db('products?active=eq.true&select=id,name,category,material,finish,price_cents,subtitle,tag,description,image,image_angle,image_frost,image_engraved,image_frost_engraved&order=price_cents.asc'),
      db('inventory?select=product_id,size,stock'),
    ]);
    const stock = Object.fromEntries(products.map(product => [product.id, {}]));
    for (const row of inventory) if (stock[row.product_id]) stock[row.product_id][row.size] = row.stock;
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return json(res, 200, { products: products.map(product => ({
      id: product.id, name: product.name, category: product.category, material: product.material.toLowerCase(),
      finish: product.finish, price: product.price_cents / 100, subtitle: product.subtitle, tag: product.tag,
      description: product.description, img: product.image, imgAngle: product.image_angle,
      imgFrost: product.image_frost, imgEngraved: product.image_engraved,
      imgFrostEngraved: product.image_frost_engraved, stock: stock[product.id],
    })) });
  } catch (error) {
    console.error('products:', error.message);
    return json(res, 503, { error: 'Produktdaten sind vorübergehend nicht verfügbar.' });
  }
}
