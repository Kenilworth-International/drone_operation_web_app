import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

export default function SuggestionPortal({
  open,
  anchorRect,
  anchorRef,
  children,
  className = "",
}) {
  const [container] = useState(() => document.createElement("div"));
  const [rect, setRect] = useState(anchorRect || null);
  const rafRef = useRef(null);

  useEffect(() => {
    document.body.appendChild(container);
    return () => {
      if (document.body.contains(container))
        document.body.removeChild(container);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [container]);

  useEffect(() => {
    if (anchorRect) setRect(anchorRect);
  }, [anchorRect]);

  useEffect(() => {
    if (!anchorRef || !anchorRef.current) return undefined;

    const updateRect = () => {
      if (anchorRef.current) {
        const r = anchorRef.current.getBoundingClientRect();
        setRect(r);
      }
      rafRef.current = requestAnimationFrame(updateRect);
    };

    // Start one immediate read then schedule continuous updates while open
    if (open) {
      updateRect();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [anchorRef, open]);

  if (!open || !rect) return null;

  const style = {
    position: "fixed",
    top: `${rect.bottom}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 12000,
  };

  return createPortal(
    <div
      className={className}
      style={style}
      data-portal="employee-suggestion-portal"
    >
      {children}
    </div>,
    container,
  );
}
