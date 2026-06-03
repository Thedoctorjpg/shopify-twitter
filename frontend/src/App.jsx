import { useState, useEffect } from 'react'
import './App.css'

const API = 'http://localhost:3000' // Change for prod, or use /api with proxy

function App() {
  const [shopifyProducts, setShopifyProducts] = useState([])
  const [ebayProducts, setEbayProducts] = useState([])
  const [aliProducts, setAliProducts] = useState([])
  const [loading, setLoading] = useState({ shopify: false, ebay: false, ali: false })
  const [message, setMessage] = useState('')
  const [searchTerms, setSearchTerms] = useState({ ebay: '', ali: '' })

  const showMessage = (msg, isError = false) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 4000)
  }

  const fetchShopify = async () => {
    setLoading(l => ({ ...l, shopify: true }))
    try {
      const res = await fetch(`${API}/products?limit=8`)
      const data = await res.json()
      setShopifyProducts(data)
    } catch (e) {
      showMessage('Failed to load Shopify products', true)
    }
    setLoading(l => ({ ...l, shopify: false }))
  }

  const fetchEbay = async (q = '') => {
    setLoading(l => ({ ...l, ebay: true }))
    try {
      const url = q ? `${API}/ebay/products?limit=8&q=${encodeURIComponent(q)}` : `${API}/ebay/products?limit=8`
      const res = await fetch(url)
      const data = await res.json()
      setEbayProducts(data)
    } catch (e) {
      showMessage('Failed to load eBay products', true)
    }
    setLoading(l => ({ ...l, ebay: false }))
  }

  const fetchAli = async (q = '') => {
    setLoading(l => ({ ...l, ali: true }))
    try {
      const url = q ? `${API}/aliexpress/search?limit=8&q=${encodeURIComponent(q)}` : `${API}/aliexpress/search?limit=8&q=trending`
      const res = await fetch(url)
      const data = await res.json()
      setAliProducts(data)
    } catch (e) {
      showMessage('Failed to load AliExpress products', true)
    }
    setLoading(l => ({ ...l, ali: false }))
  }

  const refreshAll = () => {
    fetchShopify()
    fetchEbay(searchTerms.ebay)
    fetchAli(searchTerms.ali)
  }

  useEffect(() => {
    refreshAll()
  }, [])

  const tweetProduct = async (platform, item, customText = null) => {
    let endpoint = ''
    let body = {}

    if (platform === 'shopify') {
      endpoint = '/tweet-product'
      body = { productId: item.id, customText }
    } else if (platform === 'ebay') {
      endpoint = '/tweet-ebay-product'
      body = { itemId: item.itemId || item.id || item.sku, item, customText }
    } else if (platform === 'ali') {
      endpoint = '/tweet-aliexpress-product'
      body = { itemId: item.product_id || item.id, item, keywords: item.title }
    }

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      showMessage(`Tweeted ${platform} item! ${data.result?.mock ? '(mock)' : ''}`)
    } catch (e) {
      showMessage(`Tweet failed: ${e.message}`, true)
    }
  }

  const importToShopify = async (platform, item) => {
    if (platform === 'shopify') {
      showMessage('Already a Shopify product', true)
      return
    }
    const endpoint = '/import/to-shopify'
    const body = { platform, item }

    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      showMessage(`Imported to Shopify draft! ID: ${data.shopifyProduct?.id || 'N/A'}`)
    } catch (e) {
      showMessage(`Import failed: ${e.message}`, true)
    }
  }

  const triggerCron = async () => {
    try {
      const res = await fetch(`${API}/cron/trigger-summary`, { method: 'POST' })
      const data = await res.json()
      showMessage(`Daily summary triggered! ${data.result?.items?.length || 0} items`)
    } catch (e) {
      showMessage('Cron trigger failed', true)
    }
  }

  const ProductCard = ({ product, platform }) => {
    const title = product.title || product.product_title || 'Untitled'
    const price = product.price || product.variants?.[0]?.price || product.sale_price || '?'
    const img = product.images?.[0]?.src || product.image?.imageUrl || product.product_main_image_url || product.thumbnailImages?.[0]?.imageUrl || 'https://via.placeholder.com/120'
    const url = product.url || product.itemWebUrl || product.product_detail_url || '#'

    return (
      <div className="product-card">
        <img src={img} alt={title} className="product-img" />
        <div className="product-info">
          <div className="product-platform">{platform}</div>
          <h4>{title.substring(0, 60)}{title.length > 60 ? '...' : ''}</h4>
          <div className="product-price">${price}</div>
          <div className="product-actions">
            <button onClick={() => tweetProduct(platform.toLowerCase().replace('express', ''), product)}>
              🐦 Tweet
            </button>
            {platform !== 'Shopify' && (
              <button onClick={() => importToShopify(platform.toLowerCase().replace('express', ''), product)} className="import-btn">
                📥 Import to Shopify
              </button>
            )}
            <a href={url} target="_blank" rel="noopener" className="view-link">View →</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header>
        <h1>🛍️ Multi-Platform Dashboard</h1>
        <p>Shopify + eBay + AliExpress → X (Twitter) + Imports</p>
        <div className="header-actions">
          <button onClick={refreshAll} disabled={Object.values(loading).some(Boolean)}>🔄 Refresh All</button>
          <button onClick={triggerCron} className="primary">📅 Trigger Daily Summary</button>
        </div>
        {message && <div className="toast">{message}</div>}
      </header>

      <div className="platforms">
        {/* Shopify */}
        <section className="platform-section">
          <div className="section-header">
            <h2>🛒 Shopify</h2>
            <button onClick={fetchShopify} disabled={loading.shopify}>Load</button>
          </div>
          <div className="products-grid">
            {loading.shopify && <p>Loading...</p>}
            {shopifyProducts.length === 0 && !loading.shopify && <p>No products. Make sure backend running.</p>}
            {shopifyProducts.map((p, i) => (
              <ProductCard key={i} product={p} platform="Shopify" />
            ))}
          </div>
        </section>

        {/* eBay */}
        <section className="platform-section">
          <div className="section-header">
            <h2>🛍️ eBay</h2>
            <input 
              placeholder="Search eBay..." 
              value={searchTerms.ebay} 
              onChange={e => setSearchTerms(s => ({...s, ebay: e.target.value}))}
              onKeyDown={e => e.key === 'Enter' && fetchEbay(searchTerms.ebay)}
            />
            <button onClick={() => fetchEbay(searchTerms.ebay)} disabled={loading.ebay}>Search</button>
          </div>
          <div className="products-grid">
            {loading.ebay && <p>Loading...</p>}
            {ebayProducts.map((p, i) => (
              <ProductCard key={i} product={p} platform="eBay" />
            ))}
          </div>
        </section>

        {/* AliExpress */}
        <section className="platform-section">
          <div className="section-header">
            <h2>🔥 AliExpress</h2>
            <input 
              placeholder="Search AliExpress..." 
              value={searchTerms.ali} 
              onChange={e => setSearchTerms(s => ({...s, ali: e.target.value}))}
              onKeyDown={e => e.key === 'Enter' && fetchAli(searchTerms.ali)}
            />
            <button onClick={() => fetchAli(searchTerms.ali)} disabled={loading.ali}>Search</button>
          </div>
          <div className="products-grid">
            {loading.ali && <p>Loading...</p>}
            {aliProducts.map((p, i) => (
              <ProductCard key={i} product={p} platform="AliExpress" />
            ))}
          </div>
        </section>
      </div>

      <footer>
        <p>Backend: <a href={`${API}/`} target="_blank">{API}</a> | Built with Grok | <button onClick={triggerCron}>Run daily cron now</button></p>
        <p>Tip: Start backend with <code>npm start</code> (port 3000). Frontend on 5173.</p>
      </footer>
    </div>
  )
}

export default App
