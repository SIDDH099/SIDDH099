import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Customer,
  BlouseOrder,
  FallPicoOrder,
  MeasurementRecord,
  Product,
  DesignItem,
  NextPurchaseRequirement,
  Receipt,
  ShopSettings,
  UserMode,
  PaymentStatus
} from '../types';
import { dbService, DEFAULT_SETTINGS } from '../db/indexedDB';
import {
  isFirebaseConfigured,
  subscribeToProductsRealtime,
  subscribeToDesignsRealtime,
  saveProductToFirestore,
  deleteProductFromFirestore,
  saveDesignToFirestore,
  deleteDesignFromFirestore,
  syncAllLocalToFirestore
} from '../services/firebase';

export type ActiveTab =
  | 'dashboard'
  | 'customers'
  | 'blouse'
  | 'measurements'
  | 'palette'
  | 'designs'
  | 'demands'
  | 'fallpico'
  | 'catalogue'
  | 'my-orders'
  | 'billing'
  | 'reports'
  | 'settings';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextType {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  
  // Data
  customers: Customer[];
  blouseOrders: BlouseOrder[];
  fallPicoOrders: FallPicoOrder[];
  measurements: MeasurementRecord[];
  products: Product[];
  designs: DesignItem[];
  nextPurchases: NextPurchaseRequirement[];
  receipts: Receipt[];
  settings: ShopSettings;
  isLoading: boolean;
  isFirebaseLive: boolean;

  // Actions
  refreshAllData: () => Promise<void>;
  syncLocalToCloud: () => Promise<boolean>;
  
  // Customer actions
  saveCustomer: (customer: Partial<Customer>) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<boolean>;
  
  // Blouse Order & Measurement actions
  saveBlouseOrder: (order: Partial<BlouseOrder>) => Promise<BlouseOrder>;
  saveMeasurementRecord: (record: Partial<MeasurementRecord>) => Promise<MeasurementRecord>;
  updateOrderStatus: (id: string, status: BlouseOrder['status']) => Promise<void>;
  deleteBlouseOrder: (id: string) => Promise<boolean>;
  
  // Fall Pico actions
  saveFallPicoOrder: (order: Partial<FallPicoOrder>) => Promise<FallPicoOrder>;
  deleteFallPicoOrder: (id: string) => Promise<boolean>;
  
  // Product actions
  saveProduct: (product: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<boolean>;
  
  // Design actions
  saveDesign: (design: Partial<DesignItem>) => Promise<DesignItem>;
  toggleDesignFavourite: (id: string) => Promise<void>;
  deleteDesign: (id: string) => Promise<boolean>;
  
  // Next Purchase actions
  saveNextPurchase: (req: Partial<NextPurchaseRequirement>) => Promise<NextPurchaseRequirement>;
  updateNextPurchaseStatus: (id: string, status: NextPurchaseRequirement['status']) => Promise<void>;
  deleteNextPurchase: (id: string) => Promise<boolean>;

  // Receipt actions
  saveReceipt: (receipt: Partial<Receipt>) => Promise<Receipt>;
  addReceiptPayment: (receiptId: string, amount: number, mode: 'रोख' | 'गुगल पे / फोनपे' | 'बँक ट्रान्सफर', note?: string) => Promise<void>;

  // Settings
  updateSettings: (newSettings: Partial<ShopSettings>) => Promise<void>;

  // Modal & Selection States
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  
  selectedReceiptId: string | null;
  setSelectedReceiptId: (id: string | null) => void;

  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;

  isAddCustomerOpen: boolean;
  setIsAddCustomerOpen: (open: boolean) => void;

  isAddBlouseOrderOpen: boolean;
  setIsAddBlouseOrderOpen: (open: boolean) => void;
  
  isAddFallPicoOpen: boolean;
  setIsAddFallPicoOpen: (open: boolean) => void;

  isAddProductOpen: boolean;
  setIsAddProductOpen: (open: boolean) => void;

  isAddDemandOpen: boolean;
  setIsAddDemandOpen: (open: boolean) => void;

  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;

  pinModalOpen: boolean;
  setPinModalOpen: (open: boolean) => void;

  // Measurement pre-fill helper
  prefilledMeasurements: MeasurementRecord | null;
  setPrefilledMeasurements: (m: MeasurementRecord | null) => void;

  // Blouse Summary PDF/WhatsApp Modal
  selectedBlouseSummaryId: string | null;
  setSelectedBlouseSummaryId: (id: string | null) => void;

  // WhatsApp Status Update Prompt Order
  whatsappPromptOrder: BlouseOrder | null;
  setWhatsappPromptOrder: (order: BlouseOrder | null) => void;

  // Customer Portal Login via Mobile or Order ID (or Secret Owner PIN)
  loggedInCustomer: Customer | null;
  loginCustomerByMobile: (mobile: string) => Customer | null | 'OWNER_PIN_MATCH';
  logoutCustomer: () => void;

  // Global Custom Delete Confirmation Modal
  confirmDeleteDialog: {
    isOpen: boolean;
    itemName?: string;
    message?: string;
    onConfirm: () => Promise<void> | void;
  } | null;
  requestConfirmDelete: (itemName: string, onConfirm: () => Promise<void> | void, message?: string) => void;
  closeConfirmDelete: () => void;

  // Toast
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<UserMode>(() => {
    return (localStorage.getItem('mbc_user_mode') as UserMode) || 'customer';
  });
  const [activeTab, setActiveTabState] = useState<ActiveTab>('catalogue');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [blouseOrders, setBlouseOrders] = useState<BlouseOrder[]>([]);
  const [fallPicoOrders, setFallPicoOrders] = useState<FallPicoOrder[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [designs, setDesigns] = useState<DesignItem[]>([]);
  const [nextPurchases, setNextPurchases] = useState<NextPurchaseRequirement[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Selections
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddBlouseOrderOpen, setIsAddBlouseOrderOpen] = useState(false);
  const [isAddFallPicoOpen, setIsAddFallPicoOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddDemandOpen, setIsAddDemandOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const [prefilledMeasurements, setPrefilledMeasurements] = useState<MeasurementRecord | null>(null);
  const [selectedBlouseSummaryId, setSelectedBlouseSummaryId] = useState<string | null>(null);
  const [whatsappPromptOrder, setWhatsappPromptOrder] = useState<BlouseOrder | null>(null);
  const [loggedInCustomerId, setLoggedInCustomerId] = useState<string | null>(() => {
    return localStorage.getItem('mbc_logged_customer_id');
  });
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<{
    isOpen: boolean;
    itemName?: string;
    message?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const requestConfirmDelete = (
    itemName: string,
    onConfirm: () => Promise<void> | void,
    message?: string
  ) => {
    setConfirmDeleteDialog({
      isOpen: true,
      itemName,
      message,
      onConfirm
    });
  };

  const closeConfirmDelete = () => {
    setConfirmDeleteDialog(null);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const setMode = (newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem('mbc_user_mode', newMode);
    if (newMode === 'owner') {
      setActiveTabState('dashboard');
    } else if (newMode === 'customer') {
      setActiveTabState('catalogue');
    }
  };

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      const [
        loadedCustomers,
        loadedBlouses,
        loadedFallPicos,
        loadedMeas,
        loadedProds,
        loadedDesigns,
        loadedDemands,
        loadedReceipts,
        loadedSettings
      ] = await Promise.all([
        dbService.getAll<Customer>('customers'),
        dbService.getAll<BlouseOrder>('blouseOrders'),
        dbService.getAll<FallPicoOrder>('fallPicoOrders'),
        dbService.getAll<MeasurementRecord>('measurements'),
        dbService.getAll<Product>('products'),
        dbService.getAll<DesignItem>('designs'),
        dbService.getAll<NextPurchaseRequirement>('nextPurchases'),
        dbService.getAll<Receipt>('receipts'),
        dbService.getSettings()
      ]);

      // Ensure every design has a unique designCode (even for pre-existing IndexedDB records)
      const normalizedDesigns = loadedDesigns.map((d, idx) => {
        if (d.designCode) return d;
        const cat = d.category || '';
        const prefix = cat.includes('Neck')
          ? '#N'
          : cat.includes('Sleeve')
          ? '#S'
          : cat.includes('Border')
          ? '#B'
          : cat.includes('Maggam') || cat.includes('Embroidery')
          ? '#M'
          : '#D';
        return {
          ...d,
          designCode: `${prefix}${101 + idx}`
        };
      });

      setCustomers(loadedCustomers.sort((a, b) => b.id.localeCompare(a.id)));
      setBlouseOrders(loadedBlouses.sort((a, b) => b.orderDate.localeCompare(a.orderDate)));
      setFallPicoOrders(loadedFallPicos.sort((a, b) => b.receivedDate.localeCompare(a.receivedDate)));
      setMeasurements(loadedMeas.sort((a, b) => b.date.localeCompare(a.date)));
      setProducts(loadedProds);
      setDesigns(normalizedDesigns);
      setNextPurchases(loadedDemands.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setReceipts(loadedReceipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setSettings(loadedSettings);
    } catch (err) {
      console.error('Failed to load database:', err);
      showToast('डेटा लोड करताना त्रुटी आली!', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();

    // Check deep link parameters e.g., ?product_id=101 or ?product=101
    const params = new URLSearchParams(window.location.search);
    const prodParam = params.get('product_id') || params.get('product');
    if (prodParam) {
      setSelectedProductId(prodParam);
      setActiveTabState('catalogue');
    }
  }, []);

  // Real-time Firestore Listeners (if Firebase keys are configured)
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    let productsInitialLoaded = false;
    // 1. Subscribe to Products
    const unsubProducts = subscribeToProductsRealtime((cloudProducts) => {
      if (cloudProducts && cloudProducts.length > 0) {
        setProducts(cloudProducts);
        // Cache to local IndexedDB
        cloudProducts.forEach(p => {
          dbService.save('products', p).catch(() => {});
        });
      } else if (!productsInitialLoaded) {
        productsInitialLoaded = true;
        // If Firestore collection is brand new and empty, auto-upload current catalogue
        dbService.getAll<Product>('products').then(localProds => {
          if (localProds && localProds.length > 0) {
            localProds.forEach(p => {
              saveProductToFirestore(p).catch(() => {});
            });
          }
        }).catch(() => {});
      }
    });

    let designsInitialLoaded = false;
    // 2. Subscribe to Designs
    const unsubDesigns = subscribeToDesignsRealtime((cloudDesigns) => {
      if (cloudDesigns && cloudDesigns.length > 0) {
        setDesigns(cloudDesigns);
        // Cache to local IndexedDB
        cloudDesigns.forEach(d => {
          dbService.save('designs', d).catch(() => {});
        });
      } else if (!designsInitialLoaded) {
        designsInitialLoaded = true;
        // If Firestore designs collection is empty, auto-upload current designs
        dbService.getAll<DesignItem>('designs').then(localDesigns => {
          if (localDesigns && localDesigns.length > 0) {
            localDesigns.forEach(d => {
              saveDesignToFirestore(d).catch(() => {});
            });
          }
        }).catch(() => {});
      }
    });

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubDesigns) unsubDesigns();
    };
  }, []);

  // CUSTOMER CRUD
  const saveCustomer = async (custData: Partial<Customer>): Promise<Customer> => {
    let customerId = custData.id;
    if (!customerId) {
      customerId = await dbService.generateNextCustomerId();
    }

    const newCustomer: Customer = {
      id: customerId,
      name: custData.name || '',
      mobile: custData.mobile || '',
      address: custData.address || '',
      birthDate: custData.birthDate || '',
      anniversaryDate: custData.anniversaryDate || '',
      specialNotes: custData.specialNotes || '',
      registrationDate: custData.registrationDate || new Date().toISOString().split('T')[0],
      colourPreferences: custData.colourPreferences || [],
      favouriteDesignIds: custData.favouriteDesignIds || []
    };

    await dbService.save('customers', newCustomer);
    await refreshAllData();
    showToast(`ग्राहक ${newCustomer.name} (ID: ${newCustomer.id}) यशस्वीरित्या सेव्ह झाला!`);
    return newCustomer;
  };

  const deleteCustomer = async (id: string): Promise<boolean> => {
    await dbService.delete('customers', id);
    await refreshAllData();
    showToast('ग्राहक यशस्वीरित्या हटवला.', 'info');
    return true;
  };

  // BLOUSE ORDER CRUD
  const saveBlouseOrder = async (orderData: Partial<BlouseOrder>): Promise<BlouseOrder> => {
    const isNew = !orderData.id;
    const orderId = orderData.id || `BL-${Date.now().toString().slice(-6)}`;
    const orderNumber = orderData.orderNumber || `BO-${Math.floor(100 + Math.random() * 900)}`;

    const total = Number(orderData.totalAmount) || 0;
    const advance = Number(orderData.advanceAmount) || 0;
    const balance = Math.max(0, total - advance);

    let paymentStatus: BlouseOrder['paymentStatus'] = 'बाकी आहे';
    if (balance === 0 && total > 0) {
      paymentStatus = 'पूर्ण जमा';
    } else if (advance > 0) {
      paymentStatus = 'अंशतः जमा';
    }

    const order: BlouseOrder = {
      id: orderId,
      orderNumber,
      customerId: orderData.customerId || '',
      customerName: orderData.customerName || '',
      customerMobile: orderData.customerMobile || '',
      orderDate: orderData.orderDate || new Date().toISOString().split('T')[0],
      deliveryDate: orderData.deliveryDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      pattern: orderData.pattern || 'साधा',
      status: orderData.status || 'नवीन ऑर्डर',
      measurements: orderData.measurements || {
        height: '',
        length: '',
        chest: '',
        waist: '',
        shoulder: '',
        sleeveLength: '',
        armhole: '',
        frontNeck: '',
        backNeck: ''
      },
      frontNeckImage: orderData.frontNeckImage,
      backNeckImage: orderData.backNeckImage,
      sleeveImage: orderData.sleeveImage,
      referenceImage: orderData.referenceImage,
      blouseColor: orderData.blouseColor || '',
      blouseColorHex: orderData.blouseColorHex || '',
      selectedDesignIds: orderData.selectedDesignIds || [],
      selectedDesignCodes: orderData.selectedDesignCodes || [],
      totalAmount: total,
      advanceAmount: advance,
      balanceAmount: balance,
      paymentStatus,
      notes: orderData.notes || '',
      createdAt: orderData.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };

    await dbService.save('blouseOrders', order);

    // Also record measurement version in measurements history
    if (order.customerId && order.measurements && (order.measurements.chest || order.measurements.length)) {
      const measRecord: MeasurementRecord = {
        id: `meas-${Date.now()}`,
        customerId: order.customerId,
        date: order.orderDate,
        orderId: order.id,
        pattern: order.pattern,
        measurements: order.measurements,
        notes: `ऑर्डर ${order.orderNumber} चे माप`
      };
      await dbService.save('measurements', measRecord);
    }

    // Auto-generate or update digital receipt
    const existingReceipts = await dbService.getAll<Receipt>('receipts');
    const existingRec = existingReceipts.find(r => r.orderId === order.id);

    const receiptNum = existingRec?.receiptNumber || `पावती क्र. ${Math.floor(1000 + Math.random() * 9000)}`;
    const customMeasText = order.measurements.customMeasurements?.length
      ? ` | ${order.measurements.customMeasurements.map(cm => `${cm.label}: ${cm.value}"`).join(' | ')}`
      : '';
    const receipt: Receipt = {
      id: existingRec?.id || `REC-${Date.now()}`,
      receiptNumber: receiptNum,
      orderId: order.id,
      orderType: 'ब्लाऊज शिलाई',
      customerId: order.customerId,
      customerName: order.customerName,
      customerMobile: order.customerMobile,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      itemDescription: `${order.pattern} ब्लाऊज शिलाई${order.blouseColor ? ` (${order.blouseColor})` : ''}${order.selectedDesignCodes?.length ? ` [डिझाईन: ${order.selectedDesignCodes.join(', ')}]` : ''} (${order.orderNumber})`,
      measurementsSummary: `छाती: ${order.measurements.chest || '-'}" | कंबर: ${order.measurements.waist || '-'}" | दंडघेर: ${order.measurements.armhole || '-'}" | लांबी: ${order.measurements.length || '-'}"${customMeasText}`,
      blouseColor: order.blouseColor,
      blouseColorHex: order.blouseColorHex,
      referenceImage: order.referenceImage,
      selectedDesignCodes: order.selectedDesignCodes,
      totalAmount: order.totalAmount,
      advanceAmount: order.advanceAmount,
      balanceAmount: order.balanceAmount,
      paymentStatus: order.paymentStatus,
      paymentHistory: existingRec?.paymentHistory || [
        ...(advance > 0 ? [{
          amount: advance,
          date: order.orderDate,
          mode: 'रोख' as const,
          note: 'ऑर्डर वेळेस अ‍ॅडव्हान्स जमा'
        }] : [])
      ],
      createdAt: existingRec?.createdAt || new Date().toISOString().split('T')[0]
    };
    await dbService.save('receipts', receipt);

    await refreshAllData();
    showToast(isNew ? `नवीन ऑर्डर ${order.orderNumber} यशस्वीरित्या नोंदवली!` : `ऑर्डर ${order.orderNumber} अद्ययावत केली!`);
    return order;
  };

  const saveMeasurementRecord = async (recordData: Partial<MeasurementRecord>): Promise<MeasurementRecord> => {
    const rec: MeasurementRecord = {
      id: recordData.id || `meas-${Date.now()}`,
      customerId: recordData.customerId || '0001',
      date: recordData.date || new Date().toISOString().split('T')[0],
      orderId: recordData.orderId,
      pattern: recordData.pattern || 'कटोरी',
      measurements: recordData.measurements || {
        height: '',
        length: '',
        chest: '',
        waist: '',
        shoulder: '',
        sleeveLength: '',
        armhole: '',
        frontNeck: '',
        backNeck: '',
        customMeasurements: []
      },
      notes: recordData.notes || ''
    };
    await dbService.save('measurements', rec);
    await refreshAllData();
    showToast('नवीन मापवही नोंद सुरक्षितपणे जतन झाली!');
    return rec;
  };

  const updateOrderStatus = async (id: string, status: BlouseOrder['status']) => {
    const order = await dbService.getById<BlouseOrder>('blouseOrders', id);
    if (!order) return;
    order.status = status;
    order.updatedAt = new Date().toISOString().split('T')[0];
    await dbService.save('blouseOrders', order);
    await refreshAllData();

    if (status === 'ग्राहकाला दिले') {
      showToast(`ऑर्डर ${order.orderNumber} पूर्ण झाली असून सेटिंग्जमधील 'पूर्ण झालेल्या ऑर्डर्सचा इतिहास' मध्ये साठवली गेली!`);
    } else {
      showToast(`ऑर्डर स्थिती '${status}' अशी बदलली!`);
    }

    if (status === 'काम पूर्ण' || status === 'डिलिव्हरीसाठी तयार') {
      setWhatsappPromptOrder({ ...order });
    }
  };

  const deleteBlouseOrder = async (id: string): Promise<boolean> => {
    await dbService.delete('blouseOrders', id);
    await refreshAllData();
    showToast('ब्लाऊज ऑर्डर हटवली गेली.', 'info');
    return true;
  };

  // FALL PICO CRUD
  const saveFallPicoOrder = async (orderData: Partial<FallPicoOrder>): Promise<FallPicoOrder> => {
    const isNew = !orderData.id;
    const id = orderData.id || `FP-${Date.now().toString().slice(-6)}`;
    const orderNumber = orderData.orderNumber || `FP-${Math.floor(200 + Math.random() * 800)}`;
    const qty = Number(orderData.quantity) || 1;
    const rate = Number(orderData.ratePerSaree) || 70;
    const total = qty * rate;
    const advance = Number(orderData.advanceAmount) || 0;
    const balance = Math.max(0, total - advance);

    let paymentStatus: FallPicoOrder['paymentStatus'] = 'बाकी आहे';
    if (balance === 0 && total > 0) paymentStatus = 'पूर्ण जमा';
    else if (advance > 0) paymentStatus = 'अंशतः जमा';

    const order: FallPicoOrder = {
      id,
      orderNumber,
      customerId: orderData.customerId || '',
      customerName: orderData.customerName || '',
      customerMobile: orderData.customerMobile || '',
      quantity: qty,
      workType: orderData.workType || 'फॉल-पिको',
      ratePerSaree: rate,
      totalAmount: total,
      advanceAmount: advance,
      balanceAmount: balance,
      receivedDate: orderData.receivedDate || new Date().toISOString().split('T')[0],
      deliveryDate: orderData.deliveryDate || new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      status: orderData.status || 'नवीन',
      paymentStatus,
      notes: orderData.notes || '',
      createdAt: orderData.createdAt || new Date().toISOString().split('T')[0]
    };

    await dbService.save('fallPicoOrders', order);

    // Digital receipt for fall pico
    const existingReceipts = await dbService.getAll<Receipt>('receipts');
    const existingRec = existingReceipts.find(r => r.orderId === order.id);

    const receipt: Receipt = {
      id: existingRec?.id || `REC-${Date.now()}`,
      receiptNumber: existingRec?.receiptNumber || `पावती क्र. ${Math.floor(2000 + Math.random() * 8000)}`,
      orderId: order.id,
      orderType: 'फॉल-पिको',
      customerId: order.customerId,
      customerName: order.customerName,
      customerMobile: order.customerMobile,
      orderDate: order.receivedDate,
      deliveryDate: order.deliveryDate,
      itemDescription: `${order.quantity} साड्या - ${order.workType} (@₹${order.ratePerSaree}/साडी)`,
      totalAmount: order.totalAmount,
      advanceAmount: order.advanceAmount,
      balanceAmount: order.balanceAmount,
      paymentStatus: order.paymentStatus,
      paymentHistory: existingRec?.paymentHistory || [
        ...(advance > 0 ? [{
          amount: advance,
          date: order.receivedDate,
          mode: 'रोख' as const,
          note: 'फॉल-पिको अ‍ॅडव्हान्स'
        }] : [])
      ],
      createdAt: existingRec?.createdAt || new Date().toISOString().split('T')[0]
    };
    await dbService.save('receipts', receipt);

    await refreshAllData();
    showToast(isNew ? `फॉल-पिको ऑर्डर ${order.orderNumber} नोंदवली!` : `फॉल-पिको ऑर्डर अद्ययावत झाली!`);
    return order;
  };

  const deleteFallPicoOrder = async (id: string): Promise<boolean> => {
    await dbService.delete('fallPicoOrders', id);
    await refreshAllData();
    showToast('फॉल-पिको नोंद हटवली.', 'info');
    return true;
  };

  // PRODUCT CRUD
  const saveProduct = async (prodData: Partial<Product>): Promise<Product> => {
    const isNew = !prodData.id;
    const id = prodData.id || `prod-${Date.now()}`;
    const productId = prodData.productId || String(Math.floor(100 + Math.random() * 900));

    const prod: Product = {
      id,
      productId,
      name: prodData.name || '',
      category: prodData.category || 'पैठणी',
      originalPrice: Number(prodData.originalPrice) || 0,
      offerPrice: Number(prodData.offerPrice) || Number(prodData.originalPrice) || 0,
      description: prodData.description || '',
      imageUrl: prodData.imageUrl || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
      inStock: prodData.inStock !== false,
      featured: prodData.featured || false,
      createdAt: prodData.createdAt || new Date().toISOString().split('T')[0]
    };

    await dbService.save('products', prod);

    // Cloud Firestore Sync (Real-time to other phones/customers)
    if (isFirebaseConfigured()) {
      saveProductToFirestore(prod).catch(err => {
        console.warn('Firebase product save warning:', err);
      });
    }

    await refreshAllData();
    showToast(isNew ? 'नवीन उत्पादन कॅटलॉगमध्ये जोडले!' : 'उत्पादन अद्ययावत झाले!');
    return prod;
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    await dbService.delete('products', id);

    // Delete from Cloud Firestore
    if (isFirebaseConfigured()) {
      deleteProductFromFirestore(id).catch(err => {
        console.warn('Firebase product delete warning:', err);
      });
    }

    await refreshAllData();
    showToast('उत्पादन कॅटलॉगमधून हटवले.', 'info');
    return true;
  };

  // DESIGN CRUD
  const saveDesign = async (designData: Partial<DesignItem>): Promise<DesignItem> => {
    const isNew = !designData.id;
    const cat = designData.category || 'Back Neck Designs';
    const prefix = cat.includes('Neck')
      ? '#N'
      : cat.includes('Sleeve')
      ? '#S'
      : cat.includes('Border')
      ? '#B'
      : cat.includes('Maggam') || cat.includes('Embroidery')
      ? '#M'
      : '#D';
    const autoCode = `${prefix}${101 + designs.length}`;
    const rawCode = (designData.designCode || autoCode).trim();
    const formattedCode = rawCode.startsWith('#') ? rawCode.toUpperCase() : `#${rawCode.toUpperCase()}`;

    const design: DesignItem = {
      id: designData.id || `des-${Date.now()}`,
      designCode: formattedCode,
      name: designData.name || 'नवीन डिझाईन',
      category: cat,
      description: designData.description || '',
      imageUrl: designData.imageUrl || '',
      isFavourite: designData.isFavourite || false,
      customerId: designData.customerId,
      orderId: designData.orderId,
      createdAt: designData.createdAt || new Date().toISOString().split('T')[0]
    };

    await dbService.save('designs', design);

    // Cloud Firestore Sync (Real-time)
    if (isFirebaseConfigured()) {
      saveDesignToFirestore(design).catch(err => {
        console.warn('Firebase design save warning:', err);
      });
    }

    await refreshAllData();
    showToast(isNew ? `डिझाईन (${design.designCode}) लायब्ररीमध्ये जोडली!` : 'डिझाईन अद्ययावत झाली!');
    return design;
  };

  const toggleDesignFavourite = async (id: string) => {
    const d = await dbService.getById<DesignItem>('designs', id);
    if (!d) return;
    d.isFavourite = !d.isFavourite;
    await dbService.save('designs', d);
    if (isFirebaseConfigured()) {
      saveDesignToFirestore(d).catch(err => {
        console.warn('Firebase toggle favourite sync warning:', err);
      });
    }
    await refreshAllData();
  };

  const deleteDesign = async (id: string): Promise<boolean> => {
    await dbService.delete('designs', id);

    // Delete from Cloud Firestore
    if (isFirebaseConfigured()) {
      deleteDesignFromFirestore(id).catch(err => {
        console.warn('Firebase design delete warning:', err);
      });
    }

    await refreshAllData();
    showToast('डिझाईन हटवली.', 'info');
    return true;
  };

  // ONE-CLICK CLOUD SYNC FOR LOCAL CATALOGUE & DESIGNS
  const syncLocalToCloud = async (): Promise<boolean> => {
    if (!isFirebaseConfigured()) {
      showToast('Firebase Config उपलब्ध नाही. कृपया सेटिंग्ज तपासा.', 'error');
      return false;
    }
    try {
      const result = await syncAllLocalToFirestore(products, designs);
      if (result.success) {
        showToast(`यशस्वी! ${result.count} आयटम्स क्लाउडवर सिंक झाले.`, 'success');
        return true;
      } else {
        showToast(`सिंक करताना त्रुटी: ${result.error}`, 'error');
        return false;
      }
    } catch (err: any) {
      showToast('सिंक करताना समस्या आली.', 'error');
      return false;
    }
  };

  // NEXT PURCHASE CRUD
  const saveNextPurchase = async (reqData: Partial<NextPurchaseRequirement>): Promise<NextPurchaseRequirement> => {
    const isNew = !reqData.id;
    const req: NextPurchaseRequirement = {
      id: reqData.id || `req-${Date.now()}`,
      customerId: reqData.customerId || '',
      customerName: reqData.customerName || '',
      customerMobile: reqData.customerMobile || '',
      category: reqData.category || 'साडी',
      itemName: reqData.itemName || '',
      fabricType: reqData.fabricType || '',
      preferredColor: reqData.preferredColor || '',
      preferredColorHex: reqData.preferredColorHex || '',
      referenceImage: reqData.referenceImage,
      designPreference: reqData.designPreference || '',
      expectedPrice: Number(reqData.expectedPrice) || undefined,
      requiredQuantity: Number(reqData.requiredQuantity) || 1,
      nextVisitDate: reqData.nextVisitDate || '',
      expectedAvailabilityDate: reqData.expectedAvailabilityDate || '',
      specialNotes: reqData.specialNotes || '',
      status: reqData.status || 'मागणी नोंदवली',
      createdAt: reqData.createdAt || new Date().toISOString().split('T')[0]
    };

    await dbService.save('nextPurchases', req);
    await refreshAllData();
    showToast(isNew ? 'पुढील खरेदीची मागणी नोंदवली!' : 'मागणी माहिती अद्ययावत झाली!');
    return req;
  };

  const updateNextPurchaseStatus = async (id: string, status: NextPurchaseRequirement['status']) => {
    const item = await dbService.getById<NextPurchaseRequirement>('nextPurchases', id);
    if (!item) return;
    item.status = status;
    await dbService.save('nextPurchases', item);
    await refreshAllData();
    showToast(`मागणी स्थिती '${status}' अशी बदलली!`);
  };

  const deleteNextPurchase = async (id: string): Promise<boolean> => {
    await dbService.delete('nextPurchases', id);
    await refreshAllData();
    showToast('खरेदी मागणी हटवली.', 'info');
    return true;
  };

  // RECEIPT ACTIONS
  const saveReceipt = async (rData: Partial<Receipt>): Promise<Receipt> => {
    const r: Receipt = {
      id: rData.id || `REC-${Date.now()}`,
      receiptNumber: rData.receiptNumber || `पावती क्र. ${Math.floor(1000 + Math.random() * 9000)}`,
      orderId: rData.orderId || '',
      orderType: rData.orderType || 'ब्लाऊज शिलाई',
      customerId: rData.customerId || '',
      customerName: rData.customerName || '',
      customerMobile: rData.customerMobile || '',
      orderDate: rData.orderDate || new Date().toISOString().split('T')[0],
      deliveryDate: rData.deliveryDate || '',
      itemDescription: rData.itemDescription || '',
      measurementsSummary: rData.measurementsSummary,
      blouseColor: rData.blouseColor,
      blouseColorHex: rData.blouseColorHex,
      referenceImage: rData.referenceImage,
      selectedDesignCodes: rData.selectedDesignCodes,
      totalAmount: Number(rData.totalAmount) || 0,
      advanceAmount: Number(rData.advanceAmount) || 0,
      balanceAmount: Number(rData.balanceAmount) || 0,
      paymentStatus: rData.paymentStatus || 'बाकी आहे',
      paymentHistory: rData.paymentHistory || [],
      createdAt: rData.createdAt || new Date().toISOString().split('T')[0]
    };
    await dbService.save('receipts', r);
    await refreshAllData();
    return r;
  };

  const addReceiptPayment = async (
    receiptId: string,
    amount: number,
    paymentMode: 'रोख' | 'गुगल पे / फोनपे' | 'बँक ट्रान्सफर',
    note?: string
  ) => {
    if (mode !== 'owner') {
      showToast('सुरक्षा नियम: केवळ दुकान मालक (पिन लॉगिन करून) पावती किंवा पेमेंट अपडेट करू शकतात!', 'error');
      return;
    }

    const receipt = await dbService.getById<Receipt>('receipts', receiptId);
    if (!receipt) return;

    const newAdvance = (receipt.advanceAmount || 0) + amount;
    const newBalance = Math.max(0, receipt.totalAmount - newAdvance);

    let paymentStatus: PaymentStatus = 'अंशतः जमा';
    if (newBalance === 0) {
      paymentStatus = 'पूर्ण जमा';
    }

    receipt.advanceAmount = newAdvance;
    receipt.balanceAmount = newBalance;
    receipt.paymentStatus = paymentStatus;
    receipt.paymentHistory = [
      ...(receipt.paymentHistory || []),
      {
        amount,
        date: new Date().toISOString().split('T')[0],
        mode: paymentMode,
        note: note || 'रक्कम जमा'
      }
    ];

    await dbService.save('receipts', receipt);

    // Also update associated order
    if (receipt.orderId.startsWith('BL-')) {
      const order = await dbService.getById<BlouseOrder>('blouseOrders', receipt.orderId);
      if (order) {
        order.advanceAmount = newAdvance;
        order.balanceAmount = newBalance;
        order.paymentStatus = paymentStatus;
        await dbService.save('blouseOrders', order);
      }
    } else if (receipt.orderId.startsWith('FP-')) {
      const order = await dbService.getById<FallPicoOrder>('fallPicoOrders', receipt.orderId);
      if (order) {
        order.advanceAmount = newAdvance;
        order.balanceAmount = newBalance;
        order.paymentStatus = paymentStatus;
        await dbService.save('fallPicoOrders', order);
      }
    }

    await refreshAllData();
    showToast(`₹${amount} जमा नोंद यशस्वी! उर्वरित बाकी: ₹${newBalance}`);
  };

  const updateSettings = async (newSettings: Partial<ShopSettings>) => {
    const updated = await dbService.updateSettings(newSettings);
    setSettings(updated);
    showToast('दुकान माहिती आणि सेटिंग्ज अद्ययावत झाली!');
  };

  const loggedInCustomer = customers.find(c => c.id === loggedInCustomerId) || null;

  // Login by 10-digit Mobile Number OR Unique Order ID (e.g. BO-101, BL-2026-001) OR Unique Customer ID (e.g. 0001, 0005)
  // OR Secret Owner 4-digit PIN (e.g. 1234)
  const loginCustomerByMobile = (queryInput: string): Customer | null | 'OWNER_PIN_MATCH' => {
    const raw = queryInput.trim();
    if (!raw) return null;

    // 0. Secret Owner PIN Check: If the user enters the exact Owner PIN in the Customer Login box
    if (raw === (settings.ownerPin || '1234')) {
      setMode('owner');
      showToast('👑 मालक मोडमध्ये स्वागत आहे!');
      return 'OWNER_PIN_MATCH';
    }

    const upper = raw.toUpperCase();
    const digitsOnly = raw.replace(/\D/g, '');

    let foundCustomer: Customer | null = null;

    // 1. Check 10-digit Mobile Number match
    if (digitsOnly.length === 10) {
      foundCustomer =
        customers.find(c => c.mobile.replace(/\D/g, '').slice(-10) === digitsOnly) || null;
    }

    // 2. Check Unique Customer ID match (e.g. "0001", "0005", or "5" padded to "0005")
    if (!foundCustomer) {
      const paddedId = digitsOnly.length > 0 && digitsOnly.length <= 4 ? digitsOnly.padStart(4, '0') : raw;
      foundCustomer =
        customers.find(
          c => c.id.toUpperCase() === upper || c.id === paddedId
        ) || null;
    }

    // 3. Check Unique Blouse Order ID / Order Number (e.g. "BO-101", "BL-2026-001", "101")
    if (!foundCustomer) {
      const matchedBlouseOrder = blouseOrders.find(
        o =>
          o.orderNumber.toUpperCase() === upper ||
          o.id.toUpperCase() === upper ||
          (digitsOnly.length >= 3 && o.orderNumber.replace(/\D/g, '') === digitsOnly)
      );
      if (matchedBlouseOrder) {
        foundCustomer = customers.find(c => c.id === matchedBlouseOrder.customerId) || null;
      }
    }

    // 4. Check Unique Fall-Pico Order ID / Order Number (e.g. "FP-2026-001")
    if (!foundCustomer) {
      const matchedFpOrder = fallPicoOrders.find(
        fp =>
          fp.orderNumber.toUpperCase() === upper ||
          fp.id.toUpperCase() === upper ||
          (digitsOnly.length >= 3 && fp.orderNumber.replace(/\D/g, '') === digitsOnly)
      );
      if (matchedFpOrder) {
        foundCustomer = customers.find(c => c.id === matchedFpOrder.customerId) || null;
      }
    }

    if (foundCustomer) {
      setLoggedInCustomerId(foundCustomer.id);
      localStorage.setItem('mbc_logged_customer_id', foundCustomer.id);
      showToast(`स्वागत आहे, ${foundCustomer.name}! आपली वैयक्तिक ऑर्डर माहिती खाली पहा.`);
    }
    return foundCustomer;
  };

  const logoutCustomer = () => {
    setLoggedInCustomerId(null);
    localStorage.removeItem('mbc_logged_customer_id');
    showToast('ग्राहक खात्यातून लॉगआऊट झाले.', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        setMode,
        activeTab,
        setActiveTab,
        customers,
        blouseOrders,
        fallPicoOrders,
        measurements,
        products,
        designs,
        nextPurchases,
        receipts,
        settings,
        isLoading,
        isFirebaseLive: isFirebaseConfigured(),
        refreshAllData,
        syncLocalToCloud,
        saveCustomer,
        deleteCustomer,
        saveBlouseOrder,
        saveMeasurementRecord,
        updateOrderStatus,
        deleteBlouseOrder,
        saveFallPicoOrder,
        deleteFallPicoOrder,
        saveProduct,
        deleteProduct,
        saveDesign,
        toggleDesignFavourite,
        deleteDesign,
        saveNextPurchase,
        updateNextPurchaseStatus,
        deleteNextPurchase,
        saveReceipt,
        addReceiptPayment,
        updateSettings,
        selectedCustomerId,
        setSelectedCustomerId,
        selectedReceiptId,
        setSelectedReceiptId,
        selectedProductId,
        setSelectedProductId,
        isAddCustomerOpen,
        setIsAddCustomerOpen,
        isAddBlouseOrderOpen,
        setIsAddBlouseOrderOpen,
        isAddFallPicoOpen,
        setIsAddFallPicoOpen,
        isAddProductOpen,
        setIsAddProductOpen,
        isAddDemandOpen,
        setIsAddDemandOpen,
        globalSearchOpen,
        setGlobalSearchOpen,
        pinModalOpen,
        setPinModalOpen,
        prefilledMeasurements,
        setPrefilledMeasurements,
        selectedBlouseSummaryId,
        setSelectedBlouseSummaryId,
        whatsappPromptOrder,
        setWhatsappPromptOrder,
        loggedInCustomer,
        loginCustomerByMobile,
        logoutCustomer,
        confirmDeleteDialog,
        requestConfirmDelete,
        closeConfirmDelete,
        toasts,
        showToast,
        dismissToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
