import { useEffect, useMemo, useState } from "react";

import { getContactTrustTier, getOwnTrustTier } from "../rules.js";

import { MarketplaceInfluencePanel } from "./shared.jsx";

export function MarketWorkspace({
  state,
  listings = [],
  savedSearches = [],
  listingAlerts = [],
  listingCategories,
  listingTypes,
  listingTags,
  createListing,
  flagListing,
  flagCurrentAccountForCommerce,
  saveListingSearch,
  startDirectThread,
  openPublicProfile,
  busy,
  placeAuctionBid,
  upsertCart,
  addShopReview,
  moderateRatingRecord
}) {
  const [filters, setFilters] = useState({ category: "", city: "", keyword: "" });
  const [selectedListingId, setSelectedListingId] = useState(listings[0]?.id || null);
  const [savedSearchDraft, setSavedSearchDraft] = useState({ name: "", keywords: "", category: "", city: "" });
  const [bidAmount, setBidAmount] = useState("");
  const [reviewDraft, setReviewDraft] = useState({ title: "", body: "", rating: 5 });
  const [listingDraft, setListingDraft] = useState({
    title: "",
    category: listingCategories[0] || "",
    type: listingTypes[0]?.id || "offer",
    city: "",
    neighborhood: "",
    price: "",
    currency: "USD",
    description: "",
    tags: "",
    photos: "",
    contactId: state.contacts[0]?.id || "",
    featured: false,
    verified: false
  });
  const commercePolicy = state.commercePolicy || {};
  const commerceBlocked = Boolean(commercePolicy.commerceBlocked);

  useEffect(() => {
    if (!listings.length) {
      setSelectedListingId(null);
      return;
    }
    if (!selectedListingId || !listings.find((item) => item.id === selectedListingId)) {
      setSelectedListingId(listings[0].id);
    }
  }, [listings, selectedListingId]);

  const filteredListings = useMemo(() => {
    const escapedKeyword = String(filters.keyword || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escapedKeyword ? new RegExp(escapedKeyword, "i") : null;
    return [...listings]
      .filter((listing) => {
        if (filters.category && listing.category !== filters.category) return false;
        if (filters.city && listing.city && listing.city.toLowerCase() !== filters.city.toLowerCase()) return false;
        if (pattern) {
          if (
            !pattern.test(listing.title) &&
            !pattern.test(listing.description) &&
            !(listing.tags || []).some((tag) => pattern.test(tag))
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  }, [listings, filters]);

  const selectedListing = filteredListings.find((item) => item.id === selectedListingId) || filteredListings[0] || null;
  const selectedContact = selectedListing ? state.contacts.find((contact) => contact.id === selectedListing.contactId) : null;
  const selectedRecord = selectedContact ? state.userRecords.find((record) => record.contactId === selectedContact.id) : null;
  const shopSnapshots = (state.reputationSnapshots || []).filter((item) => item.targetType === "shop").slice(0, 4);
  const shopRatingQueue = (state.ratingModerationQueue || []).filter((item) => item.targetType === "shop" && item.status === "open").slice(0, 4);
  const recentCartItems = useMemo(() => {
    const carts = Array.isArray(state.carts) ? state.carts : [];
    const normalized = carts.flatMap((cart) => Array.isArray(cart.items) ? cart.items : []);
    return normalized.slice(0, 5);
  }, [state.carts]);

  function handleFilterChange(field) {
    return (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSavedSearchSubmit(event) {
    event.preventDefault();
    if (!savedSearchDraft.name.trim()) return;
    saveListingSearch(savedSearchDraft);
    setSavedSearchDraft({ name: "", keywords: "", category: "", city: "" });
  }

  function handleListingSubmit(event) {
    event.preventDefault();
    if (commerceBlocked) return;
    createListing({
      ...listingDraft,
      price: Number(listingDraft.price) || 0,
      tags: (listingDraft.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      photos: (listingDraft.photos || "").split(",").map((item) => item.trim()).filter(Boolean)
    });
    setListingDraft({
      title: "",
      category: listingCategories[0] || "",
      type: listingTypes[0]?.id || "offer",
      city: "",
      neighborhood: "",
      price: "",
      currency: "USD",
      description: "",
      tags: "",
      photos: "",
      contactId: state.contacts[0]?.id || "",
      featured: false,
      verified: false
    });
  }

  function renderListingBadge(status) {
    if (status === "blocked" || status === "flagged") return "badge block";
    if (status === "review") return "badge review";
    return "badge subtle";
  }

  async function submitBid() {
    if (!selectedListing || !bidAmount || commerceBlocked) return;
    const liveLot = (state.auctionLots || []).find((lot) => lot.listingId === selectedListing.id);
    if (!liveLot) return;
    await placeAuctionBid({
      lotId: liveLot.id,
      amount: Number(bidAmount),
      currency: selectedListing.currency || "USD",
      bidderId: state.profile.handle || "self",
      status: "leading"
    });
    setBidAmount("");
  }

  async function addCurrentListingToCart() {
    if (!selectedListing || commerceBlocked) return;
    const baseCart = (state.carts || [])[0];
    const items = [
      ...((baseCart && Array.isArray(baseCart.items)) ? baseCart.items : []),
      { sku: selectedListing.id, title: selectedListing.title, qty: 1, unitPrice: Number(selectedListing.price) || 0 }
    ];
    await upsertCart({
      id: baseCart?.id,
      ownerId: state.profile.handle || "self",
      currency: selectedListing.currency || "USD",
      items
    });
  }

  async function addBuyAgainItem(item) {
    if (!item || commerceBlocked) return;
    const baseCart = (state.carts || [])[0];
    const existingItems = (baseCart && Array.isArray(baseCart.items)) ? baseCart.items : [];
    const currentRow = existingItems.find((row) => row.sku === item.sku || row.title === item.title);
    const nextItems = currentRow
      ? existingItems.map((row) =>
          (row.sku === item.sku || row.title === item.title)
            ? { ...row, qty: Number(row.qty || 1) + 1 }
            : row
        )
      : [...existingItems, { sku: item.sku || `sku-${Date.now()}`, title: item.title || "Saved item", qty: 1, unitPrice: Number(item.unitPrice) || 0 }];
    await upsertCart({
      id: baseCart?.id,
      ownerId: state.profile.handle || "self",
      currency: baseCart?.currency || selectedListing?.currency || "USD",
      items: nextItems
    });
  }

  async function submitShopReview(event) {
    event.preventDefault();
    const activeShop = (state.shopProfiles || [])[0];
    if (!activeShop || !reviewDraft.title.trim()) return;
    await addShopReview({
      shopId: activeShop.id,
      author: state.profile.name || state.profile.handle || "FoxHub user",
      ...reviewDraft
    });
    setReviewDraft({ title: "", body: "", rating: 5 });
  }

  return (
    <>
      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface market-panel">
          <div className="surface-head">
            <p className="card-label">Filters & searches</p>
            <span className="badge subtle">{filteredListings.length} matches</span>
          </div>
          <div className="market-filters">
            <label>
              Category
              <select value={filters.category} onChange={handleFilterChange("category")}>
                <option value="">All categories</option>
                {listingCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <input type="text" value={filters.city} onChange={handleFilterChange("city")} placeholder="City" />
            </label>
            <label>
              Keyword
              <input type="text" value={filters.keyword} onChange={handleFilterChange("keyword")} placeholder="Keywords" />
            </label>
          </div>
          <div className="saved-searches">
            <div className="surface-head">
              <p className="card-label">Saved searches</p>
              <span className="badge subtle">{savedSearches.length} alerts</span>
            </div>
            <div className="list-stack">
              {savedSearches.map((search) => (
                <div key={search.id} className="list-row">
                  <div>
                    <strong>{search.name}</strong>
                    <p>
                      {search.category || "Any"} · {search.city || "All cities"} · {search.keywords || "Open keywords"}
                    </p>
                  </div>
                  <button type="button" className="ghost-button small" onClick={() => setFilters({ category: search.category || "", city: search.city || "", keyword: search.keywords || "" })}>
                    Apply
                  </button>
                </div>
              ))}
            </div>
            <form className="market-form" onSubmit={handleSavedSearchSubmit}>
              <label>
                Name
                <input value={savedSearchDraft.name} onChange={(event) => setSavedSearchDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                Keywords
                <input value={savedSearchDraft.keywords} onChange={(event) => setSavedSearchDraft((current) => ({ ...current, keywords: event.target.value }))} placeholder="DJ|artist" />
              </label>
              <label>
                City
                <input value={savedSearchDraft.city} onChange={(event) => setSavedSearchDraft((current) => ({ ...current, city: event.target.value }))} placeholder="City" />
              </label>
              <button type="submit" className="ghost-button" disabled={busy || !savedSearchDraft.name.trim()}>
                Save search
              </button>
            </form>
          </div>
          <div className="listing-alerts">
            <div className="surface-head">
              <p className="card-label">Alerts</p>
              <span className="badge subtle">{listingAlerts.length} burn-in</span>
            </div>
            <div className="list-stack">
              {listingAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="alert-card">
                  <strong>{alert.title}</strong>
                  <p>{alert.summary}</p>
                  <span>{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
              ))}
              {!listingAlerts.length ? <p className="panel-copy">Alerts appear when a saved search matches a new listing.</p> : null}
            </div>
          </div>
        </article>
        <article className="surface market-listings">
          <div className="surface-head">
            <p className="card-label">Listings</p>
            <span className="badge subtle">{filteredListings.length} live</span>
          </div>
          <div className="list-stack">
            {filteredListings.map((listing) => (
              <button
                key={listing.id}
                type="button"
                className={`list-button ${selectedListing?.id === listing.id ? "active" : ""}`}
                onClick={() => setSelectedListingId(listing.id)}
              >
                <div className="thread-topline">
                  <strong>{listing.title}</strong>
                  <span className={renderListingBadge(listing.status)}>{listing.status}</span>
                </div>
                <p>
                  {listing.city} · {listing.neighborhood}
                </p>
                <div className="row-meta-text">
                  ${listing.price} · {listing.category}
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>
      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface listing-detail">
          <div className="surface-head">
            <p className="card-label">Listing detail</p>
            <span className="badge subtle">{selectedListing?.type || "No listing selected"}</span>
          </div>
          {selectedListing ? (
            <>
              <div className="listing-hero">
                {selectedListing.photos?.[0] ? <img src={selectedListing.photos[0]} alt={selectedListing.title} loading="lazy" decoding="async" /> : null}
                <div>
                  <strong>{selectedListing.title}</strong>
                  <p>{selectedListing.description}</p>
                  <div className="listing-tags">
                    {(selectedListing.tags || []).map((tag) => (
                      <span key={tag} className="badge subtle">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Price</strong>
                  <p>
                    ${selectedListing.price} {selectedListing.currency}
                  </p>
                </div>
                <div>
                  <strong>Category</strong>
                  <p>{selectedListing.category}</p>
                </div>
                <div>
                  <strong>Status</strong>
                  <span className={renderListingBadge(selectedListing.status)}>{selectedListing.status}</span>
                </div>
              </div>
              <div className="list-row">
                <div>
                  <strong>Seller</strong>
                  <p>{selectedContact ? selectedContact.displayName || selectedContact.name : "Unknown"}</p>
                </div>
                <div className="list-row-meta">
                  <span className={renderListingBadge(selectedContact ? selectedContact.walletState : "")}>
                    Trust {selectedContact ? getContactTrustTier(selectedContact) : "N/A"}
                  </span>
                  <p>{selectedRecord?.notes}</p>
                </div>
              </div>
              <div className="inline-actions wrap">
                <button
                  type="button"
                  className="accent-button"
                  disabled={!selectedContact}
                  onClick={() => {
                    if (selectedContact) startDirectThread(selectedContact.id);
                  }}
                >
                  Message seller
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!selectedContact}
                  onClick={() => {
                    if (selectedContact) openPublicProfile?.(selectedContact.id);
                  }}
                >
                  View seller profile
                </button>
                <button type="button" className="ghost-button" disabled={!selectedListing} onClick={() => flagListing(selectedListing.id, "market flag")}>
                  Flag listing
                </button>
              </div>
            </>
          ) : (
            <p className="panel-copy">Select or filter for a listing to view details.</p>
          )}
        </article>
        <MarketplaceInfluencePanel selectedListing={selectedListing} startDirectThread={startDirectThread} busy={busy} />
      </section>
      <section className="surface-row two-up service-panel compliance-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Auction and cart actions</p>
            <span className="badge subtle">{(state.auctionLots || []).length} lots · {(state.carts || []).length} carts</span>
          </div>
          <div className="list-stack">
            {(state.auctionLots || []).slice(0, 4).map((lot) => (
              <div key={lot.id} className="list-row">
                <div>
                  <strong>{lot.title}</strong>
                  <p>Current bid ${lot.currentBid} · {lot.bidCount} bids</p>
                </div>
                <div className="row-meta-text">{lot.status}</div>
              </div>
            ))}
          </div>
          <div className="inline-actions wrap">
            <input type="number" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Bid amount" />
            <button type="button" className="ghost-button" onClick={() => void submitBid()} disabled={busy || !selectedListing || commerceBlocked}>Place bid</button>
            <button type="button" className="ghost-button" onClick={() => void addCurrentListingToCart()} disabled={busy || !selectedListing || commerceBlocked}>Add to cart</button>
          </div>
          <div className="list-stack">
            {(state.carts || []).slice(0, 2).map((cart) => (
              <div key={cart.id} className="list-row">
                <div>
                  <strong>{cart.ownerId || "Current cart"}</strong>
                  <p>{Array.isArray(cart.items) ? cart.items.length : 0} items</p>
                </div>
                <div className="row-meta-text">{cart.currency || "USD"}</div>
              </div>
            ))}
            {recentCartItems.length ? (
              <div className="list-row">
                <div>
                  <strong>Buy again</strong>
                  <p>One-tap reorder for recent cart items.</p>
                </div>
                <div className="inline-actions wrap">
                  {recentCartItems.map((item) => (
                    <button key={`${item.sku || item.title}`} type="button" className="ghost-button small" onClick={() => void addBuyAgainItem(item)} disabled={busy}>
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {(state.bidEvents || []).slice(0, 3).map((bid) => (
              <div key={bid.id} className="list-row">
                <div>
                  <strong>{bid.lotId}</strong>
                  <p>{bid.bidderId || "bidder"} · {bid.status || "submitted"}</p>
                </div>
                <div className="row-meta-text">${bid.amount}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Storefront reviews</p>
            <span className="badge subtle">{(state.shopReviews || []).length} reviews</span>
          </div>
          <div className="list-stack">
            {(state.shopProfiles || []).slice(0, 2).map((shop) => (
              <div key={shop.id} className="list-row">
                <div>
                  <strong>{shop.name}</strong>
                  <p>{shop.story || shop.summary || "Storefront profile"}</p>
                </div>
                <div className="row-meta-text">{shop.rating || shop.trust || "trusted"}</div>
              </div>
            ))}
            {(state.fulfillmentOrders || []).slice(0, 3).map((order) => (
              <div key={order.id} className="list-row">
                <div>
                  <strong>{order.orderNumber || order.id}</strong>
                  <p>{order.carrier || order.method || "Fulfillment"} · {order.destination || order.status}</p>
                </div>
                <div className="row-meta-text">{order.status || "active"}</div>
              </div>
            ))}
          </div>
          <form className="market-form" onSubmit={submitShopReview}>
            <label>
              Review title
              <input value={reviewDraft.title} onChange={(event) => setReviewDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Rating
              <input type="number" min="1" max="5" value={reviewDraft.rating} onChange={(event) => setReviewDraft((current) => ({ ...current, rating: event.target.value }))} />
            </label>
            <label>
              Review
              <textarea value={reviewDraft.body} onChange={(event) => setReviewDraft((current) => ({ ...current, body: event.target.value }))} />
            </label>
            <button type="submit" className="ghost-button" disabled={busy}>Add review</button>
          </form>
        </article>
      </section>
      <section className="surface-row two-up service-panel routes-panel">
        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Store reputation</p>
            <span className="badge subtle">{shopSnapshots.length} tracked</span>
          </div>
          <div className="list-stack">
            {shopSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="list-row">
                <div>
                  <strong>{snapshot.label}</strong>
                  <p>{snapshot.averageRating?.toFixed ? snapshot.averageRating.toFixed(1) : snapshot.averageRating} / 5 · {snapshot.ratingCount} ratings</p>
                </div>
                <div className="row-meta-text">{snapshot.trustTier} · {snapshot.verification}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="surface">
          <div className="surface-head">
            <p className="card-label">Store rating review</p>
            <span className="badge subtle">{shopRatingQueue.length} open</span>
          </div>
          <div className="list-stack">
            {shopRatingQueue.map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <strong>{item.targetId}</strong>
                  <p>{item.reason}</p>
                </div>
                <div className="inline-actions wrap">
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="ghost-button small" onClick={() => moderateRatingRecord(item.recordId, "removed")}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!shopRatingQueue.length ? <p className="panel-copy">No storefront ratings need review.</p> : null}
          </div>
        </article>
      </section>
      <section className="surface-row two-up service-panel routes-panel">
        <article className="surface market-posting">
          <div className="surface-head">
            <p className="card-label">Post a listing</p>
            <span className="badge subtle">Trust tier {getOwnTrustTier(state.profile)}</span>
          </div>
          <form className="market-form" onSubmit={handleListingSubmit}>
            <label>
              Title
              <input value={listingDraft.title} onChange={(event) => setListingDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Category
              <select value={listingDraft.category} onChange={(event) => setListingDraft((current) => ({ ...current, category: event.target.value }))}>
                {listingCategories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={listingDraft.type} onChange={(event) => setListingDraft((current) => ({ ...current, type: event.target.value }))}>
                {listingTypes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contact
              <select value={listingDraft.contactId} onChange={(event) => setListingDraft((current) => ({ ...current, contactId: event.target.value }))}>
                {state.contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.displayName || contact.name} · {getContactTrustTier(contact)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <input value={listingDraft.city} onChange={(event) => setListingDraft((current) => ({ ...current, city: event.target.value }))} />
            </label>
            <label>
              Neighborhood
              <input value={listingDraft.neighborhood} onChange={(event) => setListingDraft((current) => ({ ...current, neighborhood: event.target.value }))} />
            </label>
            <label>
              Price
              <input type="number" value={listingDraft.price} onChange={(event) => setListingDraft((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label>
              Description
              <textarea value={listingDraft.description} onChange={(event) => setListingDraft((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              Tags
              <input value={listingDraft.tags} onChange={(event) => setListingDraft((current) => ({ ...current, tags: event.target.value }))} placeholder={listingTags.join(", ")} />
            </label>
            <label>
              Photos
              <input value={listingDraft.photos} onChange={(event) => setListingDraft((current) => ({ ...current, photos: event.target.value }))} placeholder="Comma-separated URLs" />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={listingDraft.featured} onChange={(event) => setListingDraft((current) => ({ ...current, featured: event.target.checked }))} />
              Featured
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={listingDraft.verified} onChange={(event) => setListingDraft((current) => ({ ...current, verified: event.target.checked }))} />
              Verified badge
            </label>
            <button type="submit" className="accent-button" disabled={busy || commerceBlocked}>
              Submit listing
            </button>
            {commerceBlocked ? <p className="error-text">{commercePolicy.reason}</p> : null}
          </form>
        </article>
      </section>
    </>
  );
}

export function moderationBadgeClass(status) {
  if (status === "block") return "badge block";
  if (status === "review") return "badge review";
  return "badge subtle";
}
