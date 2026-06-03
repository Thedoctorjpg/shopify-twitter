/**
 * widgets.js
 * Server-side HTML widget generators + pure data widgets.
 * Used for quick dashboards, emails, or embedding.
 * For full frontend see option #3 in roadmap (React/Vite).
 */

import { formatCurrency, formatOrderSummary, formatProductForTweet } from './utils.js';

/**
 * Generate a clean product card HTML widget
 */
export function generateProductWidget(product) {
  const p = formatProductForTweet(product);
  const price = p.price ? `$${p.price}` : '';
  const img = p.image || 'https://via.placeholder.com/300x200?text=No+Image';
  
  return `
    <div class="product-widget" style="border:1px solid #eee;border-radius:12px;padding:16px;max-width:320px;font-family:system-ui">
      <img src="${img}" alt="${p.title}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:12px">
      <h3 style="margin:0 0 8px;font-size:18px;line-height:1.3">${p.title}</h3>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:20px;font-weight:600;color:#111">${price}</span>
        ${p.url ? `<a href="${p.url}" target="_blank" style="font-size:13px;text-decoration:none;background:#000;color:#fff;padding:6px 14px;border-radius:999px">View →</a>` : ''}
      </div>
      ${p.vendor ? `<div style="margin-top:8px;font-size:12px;color:#666">by ${p.vendor}</div>` : ''}
    </div>
  `.trim();
}

/**
 * Sales dashboard summary (data only)
 */
export function salesDashboard(orders) {
  const total = orders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
  const count = orders.length;
  const avg = count > 0 ? total / count : 0;
  
  return {
    totalSales: total,
    totalSalesFormatted: formatCurrency(total),
    orderCount: count,
    averageOrderValue: avg,
    averageOrderValueFormatted: formatCurrency(avg)
  };
}

/**
 * Generate HTML sales summary widget
 */
export function generateSalesWidget(orders) {
  const stats = salesDashboard(orders);
  const recent = orders.slice(0, 5);
  
  const rows = recent.map(o => {
    const s = formatOrderSummary(o);
    return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${s.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${s.total}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;color:#666;font-size:12px">${new Date(s.created).toLocaleDateString()}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="sales-widget" style="font-family:system-ui;max-width:520px">
      <h2 style="margin:0 0 12px">📊 Sales Snapshot</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:#f8f8f8;padding:12px;border-radius:8px">
          <div style="font-size:12px;color:#666">TOTAL SALES</div>
          <div style="font-size:28px;font-weight:700">${stats.totalSalesFormatted}</div>
        </div>
        <div style="background:#f8f8f8;padding:12px;border-radius:8px">
          <div style="font-size:12px;color:#666">ORDERS</div>
          <div style="font-size:28px;font-weight:700">${stats.orderCount}</div>
          <div style="font-size:13px;color:#666">Avg ${stats.averageOrderValueFormatted}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr><th style="text-align:left;padding:4px 8px">Order</th><th style="text-align:right;padding:4px 8px">Total</th><th style="padding:4px 8px"></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" style="padding:8px;color:#888">No recent orders</td></tr>'}</tbody>
      </table>
    </div>
  `.trim();
}

/**
 * Simple product grid HTML (multiple products)
 */
export function generateProductGrid(products, limit = 6) {
  const items = products.slice(0, limit).map(p => generateProductWidget(p)).join('\n');
  return `
    <div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">
      ${items}
    </div>
  `;
}

/**
 * Recent activity feed widget (mixed products + orders)
 */
export function generateActivityFeed(products = [], orders = []) {
  const items = [];
  
  products.slice(0, 3).forEach(p => {
    const pf = formatProductForTweet(p);
    items.push(`<div style="padding:8px 0;border-bottom:1px solid #eee">🆕 <strong>New product:</strong> ${pf.title} (${pf.price ? '$'+pf.price : ''})</div>`);
  });
  
  orders.slice(0, 3).forEach(o => {
    const os = formatOrderSummary(o);
    items.push(`<div style="padding:8px 0;border-bottom:1px solid #eee">💰 <strong>Order ${os.name}</strong> • ${os.total} from ${os.customer}</div>`);
  });

  return `
    <div class="activity-feed" style="font-family:system-ui;max-width:420px">
      <h3 style="margin-top:0">Recent Activity</h3>
      ${items.length ? items.join('') : '<p style="color:#888">No activity yet</p>'}
    </div>
  `;
}
