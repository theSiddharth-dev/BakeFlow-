import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "../CreateProduct.css";

const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;

const CATEGORIES = [
  "Breads",
  "Cakes",
  "Pastries",
  "Cookies",
  "Seasonal",
  "Beverages",
];

const CreateProduct = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("Cakes");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !title ||
      !description ||
      !amount ||
      costAmount === "" ||
      !stock ||
      images.length === 0
    ) {
      toast.error("All fields and at least 1 image are required");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);

    // 👇 FIXED KEYS (match backend validator)
    formData.append("priceAmount", Number(amount));
    formData.append("priceCurrency", "INR");
    formData.append("costPriceAmount", Number(costAmount));
    formData.append("costPriceCurrency", "INR");

    formData.append("stock", Number(stock));
    formData.append("category", category);

    images.forEach((file) => {
      formData.append("images", file);
    });

    try {
      setLoading(true);

      const res = await axios.post(`${PRODUCT_URL}/api/products/`, formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const createdProduct = res.data?.data;
      onCreated?.(createdProduct);
      toast.success("Product created successfully 🎉");
      onClose();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Product could not be created. Please verify details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h2>Create Product</h2>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input
        type="number"
        placeholder="Price (INR)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <input
        type="number"
        placeholder="Cost Price (INR)"
        value={costAmount}
        onChange={(e) => setCostAmount(e.target.value)}
      />

      <input
        type="number"
        placeholder="Stock"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
      />

      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setImages([...e.target.files])}
      />

      <div className="create-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
};

export default CreateProduct;
