// SearchModal — bare minimum, no fancy stuff, just visible modal
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchModal({ isOpen, onClose, initialQuery = "" }: SearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);

  // Simple search logic
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      onClose();
      if (navigate) navigate("/docs");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 9999,
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "4rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "4px solid #ff0000",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "500px",
          padding: "2rem",
          fontFamily: "sans-serif",
          color: "#000000",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="search"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            marginBottom: "1rem",
            border: "1px solid #cccccc",
            borderRadius: "0.5rem",
            outline: "none",
            backgroundColor: "#f8f8f8",
            color: "#000000",
          }}
        />
        <button
          onClick={() => {
            onClose();
            if (navigate) navigate("/docs");
          }}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            backgroundColor: "#ff0000",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.3rem",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Search
        </button>
      </div>
    </div>
  );
}