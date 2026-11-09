/** Public explorers for what Basket writes. */
export const walrusBlobUrl = (blobId: string) => `https://walruscan.com/mainnet/blob/${encodeURIComponent(blobId)}`;
export const suiObjectUrl = (objectId: string) => `https://suiscan.xyz/mainnet/object/${encodeURIComponent(objectId)}`;
export const suiCheckpointUrl = (sequence: string) => `https://suiscan.xyz/mainnet/checkpoint/${encodeURIComponent(sequence)}`;
export const suiAccountUrl = (address: string) => `https://suiscan.xyz/mainnet/account/${encodeURIComponent(address)}`;

export function shortId(id: string, head = 6, tail = 4): string {
  return id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`;
}
