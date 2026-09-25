import { Platform } from "react-native";
import Purchases, { type CustomerInfo, type PurchasesPackage } from "react-native-purchases";

let configured = false;
let identifiedUser: string | null = null;

function apiKey() {
  if (Platform.OS === "ios") return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  return undefined;
}

export async function configurePurchases(userId?: string | null) {
  if (Platform.OS === "web") return false;
  const key = apiKey();
  if (!key) return false;
  if (!configured) {
    Purchases.configure({ apiKey: key, ...(userId ? { appUserID: userId } : {}) });
    configured = true;
    identifiedUser = userId || null;
    return true;
  }
  if (userId && identifiedUser !== userId) {
    await Purchases.logIn(userId);
    identifiedUser = userId;
  }
  return true;
}

export async function getCurrentOffering(userId?: string | null) {
  const ready = await configurePurchases(userId);
  if (!ready) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function getCustomerInfo(userId?: string | null) {
  const ready = await configurePurchases(userId);
  if (!ready) return null;
  return Purchases.getCustomerInfo();
}

export function findPackage(packages: PurchasesPackage[], plan: string) {
  const needle = plan.toLowerCase();
  return packages.find((item) =>
    item.identifier.toLowerCase().includes(needle)
    || item.product.identifier.toLowerCase().includes(needle)
    || item.packageType.toLowerCase().includes(needle.replace("founder_", "")),
  );
}

export async function buyPackage(item: PurchasesPackage): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage(item);
  return result.customerInfo;
}

export async function restorePurchases(userId?: string | null): Promise<CustomerInfo> {
  const ready = await configurePurchases(userId);
  if (!ready) throw new Error("Purchases are not configured for this build.");
  return Purchases.restorePurchases();
}

export function hasActiveEntitlement(info: CustomerInfo) {
  return Object.keys(info.entitlements.active || {}).length > 0;
}

export function hasPurchasedProduct(info: CustomerInfo | null | undefined, productId?: string) {
  if (!info || !productId) return false;
  return (info.nonSubscriptionTransactions || []).some((transaction) => transaction.productIdentifier === productId);
}
