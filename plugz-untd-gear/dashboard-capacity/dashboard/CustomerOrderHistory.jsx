"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import styles from "./CustomerOrderHistory.module.css";

const FILTERS = [
  { id: "all", label: "All orders" },
  { id: "production", label: "Production" },
  { id: "sandbox", label: "Test orders" },
];

function formatDate(value) {
  if (!Number.isFinite(value)) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatAmount(amountCents, currency) {
  if (!Number.isSafeInteger(amountCents)) return "Amount unavailable";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

function readableStatus(value) {
  return String(value || "recorded").replace(/[_-]+/g, " ");
}

export default function CustomerOrderHistory({ functions, uid, supportHref = "/support" }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const loadPage = useCallback(async (cursor, append, sequence) => {
    if (!functions || !uid) {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setError("Sign in to view your orders.");
      }
      return;
    }
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const call = httpsCallable(functions, "getCustomerOrderPage");
      const response = await call({ cursor: cursor || null });
      if (sequence !== requestSequence.current) return;
      const page = Array.isArray(response.data?.orders) ? response.data.orders : [];
      setOrders((current) => append ? [...current, ...page] : page);
      setNextCursor(typeof response.data?.nextCursor === "string" ? response.data.nextCursor : null);
      setHasMore(response.data?.hasMore === true);
    } catch {
      if (sequence === requestSequence.current) {
        setError("We couldn’t load your orders. Check your connection and try again.");
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [functions, uid]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setOrders([]);
    setNextCursor(null);
    setHasMore(false);
    setError("");
    void loadPage(null, false, sequence);
    return () => { requestSequence.current += 1; };
  }, [loadPage]);

  const visibleOrders = useMemo(() => filter === "all"
    ? orders
    : orders.filter((order) => order.environment === filter), [filter, orders]);

  function retry() {
    const sequence = ++requestSequence.current;
    void loadPage(null, false, sequence);
  }

  function loadOlder() {
    if (!hasMore || loadingMore || !nextCursor) return;
    void loadPage(nextCursor, true, requestSequence.current);
  }

  return (
    <section className={styles.section} aria-labelledby="order-history-title" aria-busy={loading || loadingMore}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Account center</p>
          <h2 id="order-history-title">Order history</h2>
          <p className={styles.description}>Review receipts and fulfillment updates for your account.</p>
        </div>
        <label className={styles.filterLabel}>
          <span>Show</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      </header>

      <p className={styles.status} role="status" aria-live="polite">
        {loading ? "Loading your orders…" : loadingMore ? "Loading older orders…" : error || `${orders.length} order${orders.length === 1 ? "" : "s"} loaded`}
      </p>

      {error ? (
        <div className={styles.message}>
          <p>{error}</p>
          <button className={styles.secondaryButton} type="button" onClick={retry} disabled={loading}>Try again</button>
        </div>
      ) : loading ? (
        <div className={styles.skeletonList} aria-hidden="true">
          <div className={styles.skeleton} /><div className={styles.skeleton} />
        </div>
      ) : visibleOrders.length ? (
        <>
          <ul className={styles.list}>
            {visibleOrders.map((order) => (
              <li className={styles.card} key={order.id}>
                <div className={styles.cardTop}>
                  <div>
                    <p className={styles.eyebrow}>{order.environment === "sandbox" ? "Test receipt" : "Order"}</p>
                    <h3>#{order.id}</h3>
                  </div>
                  <span className={order.environment === "sandbox" ? styles.testBadge : styles.statusBadge}>
                    {readableStatus(order.status)}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  <span>{formatDate(order.createdAt)}</span>
                  <strong>{formatAmount(order.amountCents, order.currency || "USD")}</strong>
                </div>
                <ul className={styles.items} aria-label="Items in this order">
                  {(order.items || []).map((item, index) => (
                    <li key={`${item.title}-${index}`}>
                      <span>{item.title}{item.variant ? ` · ${item.variant}` : ""}</span>
                      <span>×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
                {order.environment === "sandbox" ? (
                  <p className={styles.note}>Sandbox order. This test receipt does not create fulfillment or carrier tracking.</p>
                ) : order.trackingUrl ? (
                  <a className={styles.link} href={order.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a>
                ) : order.fulfillmentStatus ? (
                  <p className={styles.note}>{readableStatus(order.fulfillmentStatus)}{order.estimatedDelivery ? ` · estimated ${order.estimatedDelivery}` : ""}</p>
                ) : (
                  <p className={styles.note}>Fulfillment updates will appear here when available.</p>
                )}
              </li>
            ))}
          </ul>
          {hasMore && (
            <button className={styles.secondaryButton} type="button" onClick={loadOlder} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load older orders"}
            </button>
          )}
        </>
      ) : (
        <div className={styles.message}>
          <h3>{orders.length ? "No orders match this filter." : "Your orders will appear here."}</h3>
          <p>{orders.length ? "Choose another order type to see your history." : "When you place an order, its receipt and status will be available here."}</p>
          {!orders.length && <a className={styles.link} href="/#shop">Explore the collection</a>}
        </div>
      )}

      <footer className={styles.footer}>
        <span>Only you can view your order history.</span>
        <a className={styles.link} href={supportHref}>Need help with an order?</a>
      </footer>
    </section>
  );
}
