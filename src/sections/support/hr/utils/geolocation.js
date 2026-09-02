export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Location permission denied. Please allow location access in your browser settings.'));
        else if (err.code === err.POSITION_UNAVAILABLE) reject(new Error('Location unavailable. Please try again.'));
        else reject(new Error('Failed to get location. Please try again.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

export function watchBrowserLocation(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation is not supported by your browser.'));
    return () => {};
  }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => {
      if (err.code === err.PERMISSION_DENIED) onError?.(new Error('Location permission denied. Please allow location access in your browser settings.'));
      else if (err.code === err.POSITION_UNAVAILABLE) onError?.(new Error('Location unavailable. Please try again.'));
      else onError?.(new Error('Failed to get location. Please try again.'));
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
  return () => navigator.geolocation.clearWatch(watchId);
}
