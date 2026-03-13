
export interface CinetPayConfig {
    apikey: string;
    site_id: string;
    notify_url: string;
    mode: 'PRODUCTION' | 'DEVELOPMENT';
}

export interface PaymentData {
    transaction_id: string;
    amount: number;
    currency: string;
    channels: string;
    description: string;
    // Customer data
    customer_name?: string;
    customer_surname?: string;
    customer_email?: string;
    customer_phone_number?: string;
    customer_address?: string;
    customer_city?: string;
    customer_country?: string;
    customer_state?: string;
    customer_zip_code?: string;
}

declare global {
    interface Window {
        CinetPay: any;
    }
}

export const CinetPayService = {
    initialize: () => {
        // This would typically load the SDK script if not present
        if (!document.getElementById('cinetpay-script')) {
            const script = document.createElement('script');
            script.id = 'cinetpay-script';
            script.src = 'https://cdn.cinetpay.com/seamless/main.js';
            script.async = true;
            document.body.appendChild(script);
        }
    },

    checkout: (paymentData: PaymentData) => {
        return new Promise((resolve, reject) => {
            if (typeof window.CinetPay === 'undefined') {
                reject(new Error("CinetPay SDK not loaded"));
                return;
            }

            const config: CinetPayConfig = {
                apikey: import.meta.env.VITE_CINETPAY_API_KEY || '',
                site_id: import.meta.env.VITE_CINETPAY_SITE_ID || '',
                notify_url: 'http://localhost:8080/api/webhook/cinetpay', // Simulation or real webhook
                mode: 'DEVELOPMENT', // or PRODUCTION based on env
                ...paymentData
            };

            window.CinetPay.setConfig(config);

            window.CinetPay.getCheckout({
                ...paymentData,
                apikey: config.apikey,
                site_id: config.site_id,
                notify_url: config.notify_url,
            });

            window.CinetPay.waitResponse((data: any) => {
                if (data.status === "ACCEPTED") {
                    resolve(data);
                } else {
                    reject(data);
                }
            });

            window.CinetPay.onError((data: any) => {
                reject(data);
            });
        });
    }
};
