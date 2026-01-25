export async function saveAvatarToCache(key, fileOrBase64) {
  const cache = await caches.open('avatars');

  // Handle both File objects and base64 strings
  let response;

  if (typeof fileOrBase64 === 'string') {
    // It's a base64 data URL
    const blob = await fetch(fileOrBase64).then((r) => r.blob());
    response = new Response(blob);
  } else {
    // It's a File object
    response = new Response(fileOrBase64);
  }

  await cache.put(key, response);
}

export async function getAvatarFromCache(key) {
  const cache = await caches.open('avatars');
  const res = await cache.match(key);
  return res ? URL.createObjectURL(await res.blob()) : null;
}

export async function deleteAvatarFromCache(key) {
  const cache = await caches.open('avatars');
  await cache.delete(key);
}

export default { saveAvatarToCache, getAvatarFromCache, deleteAvatarFromCache };
