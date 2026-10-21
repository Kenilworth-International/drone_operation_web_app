import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

/**
 * Image lightbox with zoom (+ / −), mouse wheel, and drag-to-pan when zoomed.
 */
export default function ZoomableImageDialog({
  open,
  src,
  title = 'Image',
  alt = 'Preview',
  onClose,
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const stageRef = useRef(null);
  const closeBtnRef = useRef(null);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) return;
    resetView();
    // Avoid aria-hidden warning: opener button must not keep focus under #root.
    const active = document.activeElement;
    if (active instanceof HTMLElement && !active.closest('.MuiModal-root')) {
      active.blur();
    }
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus?.({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, src, resetView]);

  const zoomBy = useCallback((delta) => {
    setZoom((prev) => {
      const next = clampZoom(prev + delta);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      zoomBy(delta);
    },
    [zoomBy]
  );

  useEffect(() => {
    const node = stageRef.current;
    if (!open || !node) return undefined;
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, [open, handleWheel]);

  const onPointerDown = (event) => {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setDragging(true);
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    setOffset({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    });
  };

  const onPointerUp = (event) => {
    if (!dragRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_) {
      /* ignore */
    }
    dragRef.current = null;
    setDragging(false);
  };

  const zoomLabel = `${Math.round(zoom * 100)}%`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      disableRestoreFocus
      keepMounted={false}
      PaperProps={{
        sx: { maxHeight: '92vh' },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          pr: 1.5,
          py: 1.25,
        }}
      >
        <Typography component="span" variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
          <Tooltip title="Zoom out">
            <span>
              <IconButton
                size="small"
                onClick={() => zoomBy(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Typography
            variant="caption"
            sx={{
              minWidth: 3.2,
              textAlign: 'center',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'text.secondary',
            }}
          >
            {zoomLabel}
          </Typography>
          <Tooltip title="Zoom in">
            <span>
              <IconButton
                size="small"
                onClick={() => zoomBy(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reset zoom">
            <span>
              <IconButton
                size="small"
                onClick={resetView}
                disabled={zoom === 1 && offset.x === 0 && offset.y === 0}
                aria-label="Reset zoom"
              >
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, bgcolor: '#0f172a0a' }}>
        <Box
          ref={stageRef}
          sx={{
            position: 'relative',
            height: { xs: '58vh', sm: '68vh' },
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: zoom > 1 ? 'grab' : 'default',
            userSelect: 'none',
            touchAction: 'none',
            '&:active': zoom > 1 ? { cursor: 'grabbing' } : undefined,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => (zoom > 1 ? resetView() : zoomBy(ZOOM_STEP))}
        >
          {src ? (
            <Box
              component="img"
              src={src}
              alt={alt}
              draggable={false}
              sx={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 1,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: dragging ? 'none' : 'transform 0.12s ease-out',
                pointerEvents: 'none',
                boxShadow: '0 8px 28px rgba(15, 23, 42, 0.18)',
              }}
            />
          ) : null}
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            py: 0.6,
            color: 'text.secondary',
            bgcolor: 'background.paper',
          }}
        >
          Mouse wheel to zoom · + / − buttons · drag when zoomed · double-click to zoom / reset
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button ref={closeBtnRef} onClick={onClose} autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
