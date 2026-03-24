import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./OwnerInventory.css";

const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
const PAGE_SIZE = 20;

const formatCurrency = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `Rs. ${amount}`;
  }
};

const getInventoryStatus = (stock) => {
  const qty = Number(stock || 0);
  if (qty <= 5) return "Low Stock";
  return "In Stock";
};

const OwnerInventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showStockModal, setShowStockModal] = useState(false);
  const [updatingStock, setUpdatingStock] = useState(false);
  const [stockForm, setStockForm] = useState({
    productId: "",
    stock: "",
    expiryDate: "",
    note: "",
  });

  const fetchOwnerInventory = async () => {
    if (!PRODUCT_URL) {
      setError("Product service URL is not configured");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      let skip = 0;
      let hasMore = true;
      const allProducts = [];

      // Backend owner endpoint is paginated with limit=20 max, so collect all pages.
      while (hasMore) {
        const response = await axios.get(`${PRODUCT_URL}/api/products/owner`, {
          headers,
          params: {
            skip,
            limit: PAGE_SIZE,
          },
        });

        const pageData = response?.data?.data || [];
        allProducts.push(...pageData);
        skip += pageData.length;
        hasMore = pageData.length === PAGE_SIZE;
      }

      setItems(allProducts);
      setError("");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Inventory could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnerInventory();
  }, []);

  const inventoryItems = useMemo(() => {
    return (items || [])
      .filter((product) => Number(product?.stock || 0) > 0)
      .map((product) => {
        const stock = Number(product?.stock || 0);
        const unitAmount = Number(product?.price?.amount || 0);

        return {
          id: product?._id,
          product: product?.title || "Unnamed Product",
          stock,
          status: getInventoryStatus(stock),
          expiry: product?.expiryDate
            ? new Date(product.expiryDate).toLocaleDateString("en-IN")
            : "-",
          note: product?.stockNote?.trim() || "-",
          value: unitAmount * stock,
          currency: product?.price?.currency || "INR",
        };
      });
  }, [items]);

  const openStockModal = () => {
    setStockForm({
      productId: items?.[0]?._id || "",
      stock: "",
      expiryDate: "",
      note: "",
    });
    setShowStockModal(true);
  };

  const closeStockModal = () => {
    if (updatingStock) return;
    setShowStockModal(false);
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();

    if (!stockForm.productId) {
      setError("Please select a product");
      return;
    }

    const stockValue = Number(stockForm.stock);
    if (!Number.isFinite(stockValue) || stockValue < 0) {
      setError("Stock must be a valid number >= 0");
      return;
    }

    try {
      setUpdatingStock(true);
      setError("");

      const token = localStorage.getItem("token");
      await axios.patch(
        `${PRODUCT_URL}/api/products/${stockForm.productId}`,
        {
          stock: stockValue,
          expiryDate: stockForm.expiryDate || undefined,
          stockNote: stockForm.note || "",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      await fetchOwnerInventory();
      window.dispatchEvent(new Event("owner-data-changed"));
      setShowStockModal(false);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Stock update failed. Please verify details and try again.",
      );
    } finally {
      setUpdatingStock(false);
    }
  };

  return (
    <div className="owner-inventory-page">
      <div className="owner-inventory-head">
        <div>
          <h1>Inventory Management</h1>
        </div>

        <button
          type="button"
          className="owner-inventory-add-btn"
          onClick={openStockModal}
        >
          <span aria-hidden="true">+</span>
          Add Stock Movement
        </button>
      </div>

      {loading ? (
        <p className="owner-inventory-feedback">Loading inventory...</p>
      ) : error ? (
        <p className="owner-inventory-feedback owner-inventory-feedback--error">
          {error}
        </p>
      ) : inventoryItems.length === 0 ? (
        <p className="owner-inventory-feedback">
          No in-stock products found in inventory.
        </p>
      ) : (
        <>
          <div className="owner-inventory-table-wrap">
            <table className="owner-inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Note</th>
                  <th>Value</th>
                </tr>
              </thead>

              <tbody>
                {inventoryItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product}</strong>
                    </td>
                    <td>{item.stock}</td>
                    <td>
                      <span
                        className={`owner-inventory-status-pill owner-inventory-status-pill--${item.status
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>{item.expiry}</td>
                    <td>{item.note}</td>
                    <td>{formatCurrency(item.value, item.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="owner-inventory-cards">
            {inventoryItems.map((item) => (
              <article className="owner-inventory-card" key={`card-${item.id}`}>
                <h3>{item.product}</h3>
                <div className="owner-inventory-card-row">
                  <span>Stock</span>
                  <strong>{item.stock}</strong>
                </div>
                <div className="owner-inventory-card-row">
                  <span>Status</span>
                  <strong>
                    <span
                      className={`owner-inventory-status-pill owner-inventory-status-pill--${item.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {item.status}
                    </span>
                  </strong>
                </div>
                <div className="owner-inventory-card-row">
                  <span>Expiry</span>
                  <strong>{item.expiry}</strong>
                </div>
                <div className="owner-inventory-card-row">
                  <span>Note</span>
                  <strong>{item.note}</strong>
                </div>
                <div className="owner-inventory-card-row">
                  <span>Value</span>
                  <strong>{formatCurrency(item.value, item.currency)}</strong>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {showStockModal && (
        <div
          className="owner-inventory-modal-backdrop"
          onClick={closeStockModal}
        >
          <div
            className="owner-inventory-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Add Stock Movement</h2>

            <form className="owner-inventory-form" onSubmit={handleStockSubmit}>
              <label>
                Product Selection
                <select
                  value={stockForm.productId}
                  onChange={(event) =>
                    setStockForm((prev) => ({
                      ...prev,
                      productId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="" disabled>
                    Select product
                  </option>
                  {items.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Stock Update
                <input
                  type="number"
                  min="0"
                  value={stockForm.stock}
                  onChange={(event) =>
                    setStockForm((prev) => ({
                      ...prev,
                      stock: event.target.value,
                    }))
                  }
                  placeholder="Enter updated stock quantity"
                  required
                />
              </label>

              <label>
                Expiry Date
                <input
                  type="date"
                  value={stockForm.expiryDate}
                  onChange={(event) =>
                    setStockForm((prev) => ({
                      ...prev,
                      expiryDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Note
                <textarea
                  rows="3"
                  value={stockForm.note}
                  onChange={(event) =>
                    setStockForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                  placeholder="Add stock movement note"
                />
              </label>

              <div className="owner-inventory-form-actions">
                <button
                  type="button"
                  className="owner-inventory-cancel-btn"
                  onClick={closeStockModal}
                  disabled={updatingStock}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="owner-inventory-save-btn"
                  disabled={updatingStock}
                >
                  {updatingStock ? "Saving..." : "Save Movement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerInventory;
