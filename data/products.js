// data/products.js
module.exports = {
  esim: {
    label: "📱 eSIM Data Plans",
    tagline: "Perfect for Non-PTA phones — no PTA blocking, no taxes, no SIM swap needed.",
    plans: [
      { id: "esim_500mb", name: "500MB", price: 150, currency: "PKR" },
      { id: "esim_1gb", name: "1GB", price: 350, currency: "PKR", recommended: true },
      { id: "esim_5gb", name: "5GB", price: 1300, currency: "PKR" },
    ]
  },
  hosting: {
    label: "🌐 Hostinger Web Hosting (Reseller)",
    tagline: "Professional hosting with up to 50 websites, free domain, NVMe SSD, CDN & more.",
    features: [
      "Up to 50 websites",
      "Free domain (1 year)",
      "50GB NVMe SSD",
      "Free CDN",
      "Daily backups",
      "AI WordPress Agent & Builder",
      "5 Node.js apps",
      "WordPress Multisite",
      "Free professional email"
    ],
    plans: [
      { id: "hosting_1yr", name: "1-Year Plan", price: 4000, currency: "PKR" },
      { id: "hosting_2yr", name: "2-Year Plan", price: 13000, currency: "PKR" },
      { id: "hosting_4yr", name: "4-Year Plan", price: 22000, currency: "PKR" },
    ]
  },
  payment: {
    methods: [
      { name: "JazzCash", number: "03456754090", accountName: "Shafqat Ali Sahi" },
      { name: "Easypaisa", number: "03466544374", accountName: "Shafqat Ali Sahi" },
      { name: "Sadapay", number: "03116400376", accountName: "M. Abdullah Sahi" },
    ]
  }
};
