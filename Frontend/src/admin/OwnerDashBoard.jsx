import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import "./OwnerDashBoard.css";

const DASHBOARD_URL =
  import.meta.env.VITE_SELLER_DASHBOARD_SERVICE_URL ||
  import.meta.env.VITE_SELLER_DASHBOARD_URL;
const OWNER_DASHBOARD_POLL_INTERVAL_MS = 3000;

ChartJS.register(
  ArcElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const formatMoney = (value, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `Rs. ${Number(value || 0)}`;
  }
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const calculateStockStatus = (stock) => {
  const quantity = Number(stock || 0);
  if (quantity <= 0) return "out";
  if (quantity <= 5) return "low";
  return "healthy";
};

const OwnerDashBoard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const isFetchingRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    if (isFetchingRef.current) return;

    if (!DASHBOARD_URL) {
      setError("Seller dashboard service URL is not configured");
      setLoading(false);
      return;
    }

    try {
      isFetchingRef.current = true;
      const token = localStorage.getItem("token");

      if (!token) {
        setError("You are not logged in. Please login again.");
        setLoading(false);
        return;
      }

      const cacheBypass = { ts: Date.now() };

      const [metricsResponse, ordersResponse, productsResponse] =
        await Promise.allSettled([
          axios.get(`${DASHBOARD_URL}/metrics`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: cacheBypass,
          }),
          axios.get(`${DASHBOARD_URL}/orders`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: cacheBypass,
          }),
          axios.get(`${DASHBOARD_URL}/products`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: cacheBypass,
          }),
        ]);

      const endpointErrors = [];

      if (metricsResponse.status === "fulfilled") {
        setMetrics(metricsResponse.value?.data || null);
      } else {
        endpointErrors.push(
          metricsResponse.reason?.response?.data?.message ||
            metricsResponse.reason?.response?.data?.error ||
            metricsResponse.reason?.message ||
            "Dashboard metrics could not be loaded.",
        );
      }

      if (ordersResponse.status === "fulfilled") {
        setOrders(ordersResponse.value?.data?.orders || []);
      } else {
        endpointErrors.push(
          ordersResponse.reason?.response?.data?.message ||
            ordersResponse.reason?.response?.data?.error ||
            ordersResponse.reason?.message ||
            "Recent orders could not be loaded.",
        );
      }

      if (productsResponse.status === "fulfilled") {
        setProducts(productsResponse.value?.data?.products || []);
      } else {
        endpointErrors.push(
          productsResponse.reason?.response?.data?.message ||
            productsResponse.reason?.response?.data?.error ||
            productsResponse.reason?.message ||
            "Products summary could not be loaded.",
        );
      }

      setError(endpointErrors.length > 0 ? endpointErrors.join(" | ") : "");
    } catch (fetchError) {
      setError(
        fetchError?.response?.data?.message ||
          fetchError?.response?.data?.error ||
          fetchError?.message ||
          "Dashboard could not be loaded. Please try again.",
      );
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchDashboard();
      }
    }, OWNER_DASHBOARD_POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDashboard();
      }
    };

    const onOwnerDataChanged = () => {
      fetchDashboard();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("owner-data-changed", onOwnerDataChanged);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("owner-data-changed", onOwnerDataChanged);
    };
  }, [fetchDashboard]);

  const cards = useMemo(() => {
    if (!metrics) return [];

    return [
      {
        label: "Total Revenue",
        value: formatMoney(
          metrics?.totalRevenue?.amount,
          metrics?.totalRevenue?.currency,
        ),
        tone: "amber",
      },
      {
        label: "Monthly Revenue",
        value: formatMoney(
          metrics?.monthlyRevenue?.amount,
          metrics?.monthlyRevenue?.currency,
        ),
        tone: "teal",
      },
      {
        label: "Weekly Revenue",
        value: formatMoney(
          metrics?.weeklyRevenue?.amount,
          metrics?.weeklyRevenue?.currency,
        ),
        tone: "sky",
      },
      {
        label: "Today Revenue",
        value: formatMoney(
          metrics?.todayRevenue?.amount,
          metrics?.todayRevenue?.currency,
        ),
        tone: "indigo",
      },
      {
        label: "Sales (Today)",
        value: Number(metrics?.todaysSales || 0),
        tone: "rose",
      },
      {
        label: "Sales (Weekly)",
        value: Number(metrics?.weeklySales || 0),
        tone: "violet",
      },
      {
        label: "Sales (Monthly)",
        value: Number(metrics?.monthlySales || 0),
        tone: "orange",
      },
      {
        label: "Total Customers",
        value: Number(metrics?.totalCustomers || metrics?.totalCustomer || 0),
        tone: "emerald",
      },
    ];
  }, [metrics]);

  const chartData = useMemo(() => {
    const salesToday = Number(metrics?.todaysSales || 0);
    const salesWeek = Number(metrics?.weeklySales || 0);
    const salesMonth = Number(metrics?.monthlySales || 0);

    const todayRevenue = Number(metrics?.todayRevenue?.amount || 0);
    const weeklyRevenue = Number(metrics?.weeklyRevenue?.amount || 0);
    const monthlyRevenue = Number(metrics?.monthlyRevenue?.amount || 0);

    return {
      salesLine: {
        labels: ["Today", "This Week", "This Month"],
        datasets: [
          {
            label: "Sales",
            data: [salesToday, salesWeek, salesMonth],
            borderColor: "#de6f1f",
            backgroundColor: "rgba(222, 111, 31, 0.18)",
            pointBackgroundColor: "#9f460f",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 5,
            tension: 0.35,
            fill: true,
          },
        ],
      },
      revenueDoughnut: {
        labels: ["Today", "This Week", "This Month"],
        datasets: [
          {
            label: "Revenue",
            data: [todayRevenue, weeklyRevenue, monthlyRevenue],
            backgroundColor: ["#0f766e", "#2563eb", "#de6f1f"],
            borderColor: "#ffffff",
            borderWidth: 2,
            hoverOffset: 8,
          },
        ],
      },
    };
  }, [metrics]);

  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: "#64748b",
          },
          grid: {
            color: "rgba(100, 116, 139, 0.2)",
          },
        },
        x: {
          ticks: {
            color: "#475569",
            font: {
              weight: 700,
            },
          },
          grid: {
            display: false,
          },
        },
      },
    }),
    [],
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            color: "#334155",
            padding: 14,
            font: {
              weight: 700,
            },
          },
        },
      },
    }),
    [],
  );

  const stockSnapshot = useMemo(() => {
    const totalProducts = products.length;
    const outOfStock = products.filter(
      (item) => Number(item?.stock || 0) <= 0,
    ).length;
    const lowStock = products.filter(
      (item) => Number(item?.stock || 0) > 0 && Number(item?.stock || 0) <= 5,
    ).length;
    const healthy = totalProducts - outOfStock - lowStock;

    return {
      totalProducts,
      outOfStock,
      lowStock,
      healthy,
    };
  }, [products]);

  const recentOrders = orders.slice(0, 6);
  const topProducts = metrics?.topProducts || [];
  const lowStockItems = metrics?.lowStockItems?.items || [];

  return (
    <div className="user-panel-page owner-dashboard-page">
      <section className="owner-dashboard-hero">
        <div>
          <p className="owner-dashboard-kicker">Overview</p>
          <h1>Business Dashboard</h1>
          <p>Welcome Back! Here is your Business Overview</p>
        </div>

        <div className="owner-dashboard-hero-pill">
          <span>Avg Order Value</span>
          <strong>
            {formatMoney(
              metrics?.averageOrderValue?.amount,
              metrics?.averageOrderValue?.currency,
            )}
          </strong>
        </div>
      </section>

      {loading ? (
        <p className="owner-dashboard-feedback">Loading dashboard...</p>
      ) : error ? (
        <p className="owner-dashboard-feedback owner-dashboard-feedback--error">
          {error}
        </p>
      ) : (
        <>
          <section className="owner-dashboard-card-grid">
            {cards.map((card) => (
              <article
                key={card.label}
                className={`owner-dashboard-card owner-dashboard-card--${card.tone}`}
              >
                <p>{card.label}</p>
                <h3>{card.value}</h3>
              </article>
            ))}
          </section>

          <section className="owner-dashboard-layout-grid">
            <article className="owner-dashboard-panel owner-dashboard-panel--wide">
              <header>
                <h2>Sales Performance</h2>
                <span>Live trend and revenue split</span>
              </header>

              <div className="owner-dashboard-chart-grid">
                <div className="owner-dashboard-chart-card">
                  <div className="owner-dashboard-chart-head">
                    <h3>Sales Trend</h3>
                    <p>Today to monthly movement</p>
                  </div>
                  <div className="owner-dashboard-chart-wrap">
                    <Line
                      data={chartData.salesLine}
                      options={lineChartOptions}
                    />
                  </div>
                </div>

                <div className="owner-dashboard-chart-card">
                  <div className="owner-dashboard-chart-head">
                    <h3>Revenue Mix</h3>
                    <p>
                      {formatMoney(
                        metrics?.totalRevenue?.amount,
                        metrics?.totalRevenue?.currency,
                      )}
                    </p>
                  </div>
                  <div className="owner-dashboard-chart-wrap owner-dashboard-chart-wrap--donut">
                    <Doughnut
                      data={chartData.revenueDoughnut}
                      options={doughnutOptions}
                    />
                  </div>
                </div>
              </div>
            </article>

            <article className="owner-dashboard-panel">
              <header>
                <h2>Inventory Snapshot</h2>
              </header>

              <div className="owner-dashboard-stat-stack">
                <div>
                  <span>Total Products</span>
                  <strong>{stockSnapshot.totalProducts}</strong>
                </div>
                <div>
                  <span>Healthy</span>
                  <strong>{stockSnapshot.healthy}</strong>
                </div>
                <div>
                  <span>Low Stock</span>
                  <strong>{stockSnapshot.lowStock}</strong>
                </div>
                <div>
                  <span>Out of Stock</span>
                  <strong>{stockSnapshot.outOfStock}</strong>
                </div>
              </div>
            </article>

            <article className="owner-dashboard-panel owner-dashboard-panel--wide">
              <header>
                <h2>Recent Orders</h2>
              </header>

              {recentOrders.length === 0 ? (
                <p className="owner-dashboard-empty">No orders found.</p>
              ) : (
                <div className="owner-dashboard-table-wrap">
                  <table className="owner-dashboard-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.orderId}>
                          <td>{String(order.orderId || "-").slice(-8)}</td>
                          <td>{order?.customer?.name || "-"}</td>
                          <td>
                            <span className="owner-dashboard-chip">
                              {order?.status || "-"}
                            </span>
                          </td>
                          <td>
                            {formatMoney(
                              order?.sellerTotal?.amount,
                              order?.sellerTotal?.currency,
                            )}
                          </td>
                          <td>{formatDate(order?.orderDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="owner-dashboard-panel">
              <header>
                <h2>Top Products</h2>
              </header>

              {topProducts.length === 0 ? (
                <p className="owner-dashboard-empty">No sales data yet.</p>
              ) : (
                <div className="owner-dashboard-product-list">
                  {topProducts.map((item) => (
                    <div
                      key={item.productId}
                      className="owner-dashboard-product-item"
                    >
                      <img
                        src={
                          item.image ||
                          "https://images.unsplash.com/photo-1579113800032-c38bd7635818?auto=format&fit=crop&w=300&q=60"
                        }
                        alt={item.title}
                      />
                      <div>
                        <h4>{item.title}</h4>
                        <p>{item.quantitySold} sold</p>
                        <span>
                          {formatMoney(
                            item?.revenue?.amount,
                            item?.revenue?.currency,
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="owner-dashboard-panel owner-dashboard-panel--wide">
              <header>
                <h2>Low Stock Alert</h2>
                <span>Threshold: {metrics?.lowStockItems?.threshold || 5}</span>
              </header>

              {lowStockItems.length === 0 ? (
                <p className="owner-dashboard-empty">
                  Great job. No low stock items.
                </p>
              ) : (
                <div className="owner-dashboard-lowstock-grid">
                  {lowStockItems.map((item) => {
                    const status = calculateStockStatus(item.stock);
                    return (
                      <div
                        key={item.productId}
                        className="owner-dashboard-lowstock-card"
                      >
                        <h4>{item.title}</h4>
                        <p>
                          <span
                            className={`owner-dashboard-dot owner-dashboard-dot--${status}`}
                          />
                          {item.stock} units remaining
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
};

export default OwnerDashBoard;
