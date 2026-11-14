import { db, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs, writeBatch } from './firebase';

export const CLIENT_ID_KEY = 'roqii_client_id';
export const NOTIFICATIONS_KEY = 'roqii_notifications';

export function generateClientId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return '';
  
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  
  if (!clientId) {
    clientId = generateClientId();
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  
  return clientId;
}

export function getClientId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CLIENT_ID_KEY);
}

export function clearClientId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CLIENT_ID_KEY);
}

// Notification types
export interface Notification {
  id: string;
  clientId: string;
  type: 'booking_confirmed' | 'booking_cancelled' | 'booking_pending' | 'booking_completed' | 'booking_deleted' | 'general';
  title: string;
  message: string;
  bookingId?: string;
  bookingNumber?: string;
  read: boolean;
  createdAt: string;
}

// Create a notification for a specific client
export async function createNotification(
  clientId: string,
  notification: Omit<Notification, 'id' | 'clientId' | 'read' | 'createdAt'>
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    await addDoc(collection(db, 'notifications'), {
      clientId,
      ...notification,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    saveNotificationLocally(clientId, notification);
  }
}

// Fallback to localStorage
function saveNotificationLocally(clientId: string, notification: Omit<Notification, 'id' | 'clientId' | 'read' | 'createdAt'>): void {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    const notifications: Notification[] = stored ? JSON.parse(stored) : [];
    
    const newNotification: Notification = {
      id: generateClientId(),
      clientId,
      ...notification,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    notifications.unshift(newNotification);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 50)));
  } catch (e) {
    console.error('Error saving notification locally:', e);
  }
}

// Get notifications for current client
export function getNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!stored) return [];
    
    const allNotifications: Notification[] = JSON.parse(stored);
    const clientId = getClientId();
    if (!clientId) return [];
    
    return allNotifications.filter(n => n.clientId === clientId);
  } catch (e) {
    return [];
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored) {
      const notifications: Notification[] = JSON.parse(stored);
      const updated = notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Error marking notification as read locally:', e);
  }

  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (e) {
    // ignore - may be local-only or missing doc
  }
}

// Mark all as read
export async function markAllNotificationsAsRead(clientId?: string | null): Promise<void> {
  if (typeof window === 'undefined') return;

  const cid = clientId || getClientId();

  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored && cid) {
      const notifications: Notification[] = JSON.parse(stored);
      const updated = notifications.map(n =>
        n.clientId === cid ? { ...n, read: true } : n
      );
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Error marking all notifications as read locally:', e);
  }

  if (!cid) return;
  try {
    const q = query(
      collection(db, 'notifications'),
      where('clientId', '==', cid),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const batch = writeBatch(db);
      snapshot.forEach(d => batch.update(d.ref, { read: true }));
      await batch.commit();
    }
  } catch (e) {
    // ignore - best effort
  }
}

// Get unread count
export function getUnreadCount(): number {
  return getNotifications().filter(n => !n.read).length;
}

// Listen for real-time notifications from Firestore
export function listenForNotifications(
  clientId: string,
  onUpdate: (notifications: Notification[]) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  
  let isMounted = true;
  
  const q = query(
    collection(db, 'notifications'),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc')
  );
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!isMounted) return;
    const notifications: Notification[] = [];
    snapshot.forEach(doc => {
      notifications.push({ id: doc.id, ...doc.data() } as Notification);
    });
    onUpdate(notifications);
  }, (err) => {
    if (!isMounted) return;
    console.error('Notifications listener error:', err);
    onUpdate(getNotifications());
  });
  
  return () => {
    isMounted = false;
    unsubscribe();
  };
}