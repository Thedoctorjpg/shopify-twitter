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
  const [generatedResults, setGeneratedResults] = useState([])
  const [twitterMetrics, setTwitterMetrics] = useState(null)
  const [adsAccess, setAdsAccess] = useState(null)

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

  const generateAd = async (product, platform) => {
    try {
      const res = await fetch(`${API}/generate-product-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product: { 
            title: product.title || product.product_title, 
            image: product.images?.[0]?.src || product.image?.imageUrl || product.product_main_image_url,
            ...product 
          }, 
          scenePrompt: `professional e-commerce ad for ${platform} product, high quality` 
        })
      })
      const data = await res.json()
      showMessage(`Generated ad with Imagine API!`)
      // Store for display
      setGeneratedResults(prev => [...prev, { platform, product: product.title, results: data.ads || data, timestamp: Date.now() }])
    } catch (e) {
      showMessage(`Ad generation failed: ${e.message}`, true)
    }
  }

  const postMarketingTweet = async (product, platform) => {
    try {
      const res = await fetch(`${API}/tweet-marketing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          item: { ...product, platform },
          options: { platform, campaign: 'product_marketing', adScene: 'eye-catching marketing visual' }
        })
      })
      const data = await res.json()
      showMessage(`Marketing tweet posted! ${data.result?.mock ? '(mock)' : ''}`)
    } catch (e) {
      showMessage(`Marketing tweet failed: ${e.message}`, true)
    }
  }

  const postSpecialEvent = async (eventName, product, platform) => {
    try {
      const res = await fetch(`${API}/tweet-special-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, item: { ...product, platform } })
      })
      const data = await res.json()
      showMessage(`Special event tweet posted for ${eventName}!`)
    } catch (e) {
      showMessage(`Event tweet failed: ${e.message}`, true)
    }
  }

  const fetchTweetMetrics = async (tweetId) => {
    if (!tweetId) return
    try {
      const res = await fetch(`${API}/tweet-metrics/${tweetId}`)
      const data = await res.json()
      setTwitterMetrics(data)
      showMessage('Metrics loaded')
    } catch (e) {
      showMessage('Failed to load metrics', true)
    }
  }

  const checkTwitterAds = async () => {
    try {
      const res = await fetch(`${API}/twitter/ads-access`)
      const data = await res.json()
      setAdsAccess(data)
    } catch (e) {
      showMessage('Failed to check ads access', true)
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
            <button onClick={() => generateAd(product, platform)} className="imagine-btn">
              ✨ Generate Ad
            </button>
            <button onClick={() => postMarketingTweet(product, platform)} className="marketing-btn">
              📈 Marketing Tweet
            </button>
            <button onClick={() => postSpecialEvent('Flash Sale', product, platform)} className="event-btn">
              🎉 Special Event
            </button>
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

      {/* Imagine Studio - xAI Grok Imagine integration */}
      <section className="imagine-section">
        <h2>✨ xAI Grok Imagine Studio</h2>
        <p>Generate product ads, variations, edits, and videos using the Grok Imagine API. Results appear below and can be used for tweets or Shopify.</p>
        
        <div className="imagine-form">
          <input 
            type="text" 
            placeholder="Prompt for new image or ad (e.g. modern product photo in luxury setting)" 
            id="imagine-prompt"
          />
          <button onClick={() => {
            const prompt = document.getElementById('imagine-prompt').value || 'professional product photo';
            fetch(`${API}/generate-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, n: 2, aspect_ratio: '16:9', resolution: '2k' })
            }).then(r => r.json()).then(data => {
              showMessage('Generated with Imagine!');
              setGeneratedResults(prev => [...prev, { platform: 'Imagine', product: prompt, results: data.images, timestamp: Date.now() }]);
            }).catch(e => showMessage('Generation failed', true));
          }}>Generate Image</button>
          <button onClick={triggerCron}>Trigger Daily Summary (with Imagine?)</button>
        </div>

        {generatedResults.length > 0 && (
          <div className="generated-results">
            <h3>Recent Generations</h3>
            {generatedResults.slice().reverse().map((gen, idx) => (
              <div key={idx} className="generated-item">
                <strong>{gen.platform} - {gen.product}</strong>
                <div className="result-images">
                  {(Array.isArray(gen.results) ? gen.results : [gen.results]).slice(0, 3).map((img, i) => {
                    const url = img?.url || (typeof img === 'string' ? img : '');
                    return url ? <img key={i} src={url} alt="generated" style={{maxWidth: '200px', margin: '4px'}} /> : null;
                  })}
                </div>
                <button onClick={() => {
                  // Tweet the first generated
                  const first = Array.isArray(gen.results) ? gen.results[0] : gen.results;
                  if (first?.url) {
                    // Simple: post a tweet with the image url via backend? For demo, alert
                    showMessage('In real app: would call tweet with generated image URL');
                    // Or fetch a custom tweet endpoint that supports image urls
                  }
                }}>Tweet this</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Twitter Marketing, Ads & Events */}
      <section className="twitter-section">
        <h2>🐦 X/Twitter Marketing Hub</h2>
        <div className="twitter-controls">
          <button onClick={checkTwitterAds}>Check Ads Access</button>
          {adsAccess && <span>Ads: {adsAccess.hasAdsAccess ? '✅' : '❌'} {adsAccess.note || ''}</span>}

          <div style={{marginTop: '10px'}}>
            <input placeholder="Tweet ID for metrics" id="metrics-id" style={{padding: '6px', marginRight: '8px'}} />
            <button onClick={() => {
              const id = document.getElementById('metrics-id').value;
              if (id) fetchTweetMetrics(id);
            }}>Get Metrics</button>
            {twitterMetrics && <pre style={{fontSize: '12px', background: '#f5f5f5', padding: '8px'}}>{JSON.stringify(twitterMetrics, null, 2)}</pre>}
          </div>

          <div style={{marginTop: '10px'}}>
            <button onClick={() => postSpecialEvent('Black Friday', {title: 'Huge Savings', price: '50'}, 'Shopify')}>Simulate Black Friday Tweet</button>
            <button onClick={() => postMarketingTweet({title: 'New Collection Drop', price: '99'}, 'eBay')}>Test Marketing Tweet</button>
            <button onClick={async () => {
              const res = await fetch(`${API}/cron/trigger-events`, {method: 'POST'});
              const data = await res.json();
              showMessage(`Events triggered: ${data.result?.eventsRun || 0}`);
            }}>Trigger Event Tweets Now</button>
          </div>
        </div>
      </section>

      <footer>
        <p>Backend: <a href={`${API}/`} target="_blank">{API}</a> | Built with Grok | <button onClick={triggerCron}>Run daily cron now</button></p>
        <p>Tip: Start backend with <code>npm start</code> (port 3000). Frontend on 5173.</p>
      </footer>
    </div>
  )
}

export default App
