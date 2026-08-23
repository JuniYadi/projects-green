import { PrismaClient, Prisma } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const DATABASE_URL = process.env.DATABASE_URL?.trim()

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable")
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
})

export const WHATSAPP_PRIVATE_FIELDS = [
  {
    id: "field-0",
    name: "phoneNumber",
    type: "tel",
    label: "Nomor Whatsapp",
    required: true,
    placeholder: "+6281234567890",
    helperText:
      "Silahkan siapkan nomor whatsapp yang ingin anda gunakan, bisa menggunakan nomor telpon kantor atau nomor mobile phone (Pastikan nomor tidak terdaftar di whatsapp biasa/bisnis pada HP Android atau IOS)",
    validationPattern: "^\\+?[0-9]{9,16}$",
  },
  {
    id: "field-1",
    name: "displayName",
    type: "text",
    label: "Nama Tampilan Whatsapp",
    required: true,
    placeholder: "PT Nama Perusahaan",
    helperText:
      "Nama Whatsapp Harus Sesuai Dengan Nama PT yang Anda Daftarkan (Minimal 3, Maksimal 25 Karakter)",
  },
  {
    id: "field-2",
    name: "profilePicture",
    type: "url",
    label: "Foto Profile Whatsapp",
    required: true,
    placeholder: "https://example.com/logo.png",
    helperText: "Lampirkan Link Foto Profil Whatsapp Anda",
  },
  {
    id: "field-3",
    name: "email",
    type: "email",
    label: "Email",
    required: true,
    placeholder: "admin@perusahaan.co.id",
    helperText:
      "Email yang anda masukkan pada form ini, Akan digunakan untuk login ke panel kami",
  },
  {
    id: "field-4",
    name: "websiteUrl",
    type: "url",
    label: "URL Website",
    required: true,
    placeholder: "https://perusahaan.co.id",
    helperText:
      "Lampirkan URL Website anda, Pastikan Website anda mencantumkan nama PT Anda dan Nomor Telpon yang sama pada berkas",
  },
  {
    id: "field-5",
    name: "businessName",
    type: "text",
    label: "Nama Bisnis atau Usaha (PT/CV)",
    required: true,
    placeholder: "PT Contoh Sukses Bersama",
    helperText: "Masukkan nama PT / CV sesuai berkas legalitas",
  },
  {
    id: "field-6",
    name: "businessCategory",
    type: "select",
    label: "Kategori Usaha",
    required: true,
    placeholder: "Pilih Kategori Usaha",
    options: [
      "Automotive",
      "Beauty SPA and Salon",
      "Clothing and Apparel",
      "Education",
      "Entertainment",
      "Event Planning and Service",
      "Finance and Banking",
      "Food and Grocery",
      "Public Service",
      "Hotel and Lodging",
      "Medical and Health",
      "Non-Profit",
      "Professional Services",
      "Shopping and Retail",
      "Travel and Transportation",
      "Restaurant",
      "Other",
    ],
  },
  {
    id: "field-7",
    name: "businessStreetAddress",
    type: "text",
    label: "Alamat Usaha - Nama Jalan",
    required: true,
    placeholder: "Jl. Jendral Sudirman No. 123, Gedung A Lantai 5",
    helperText: "Nama jalan, gedung, atau nomor kantor",
  },
  {
    id: "field-8",
    name: "businessCity",
    type: "text",
    label: "Alamat Usaha - Kabupaten/Kota",
    required: true,
    placeholder: "Jakarta Selatan",
    helperText: "Nama kabupaten atau kota",
  },
  {
    id: "field-9",
    name: "businessPostalCode",
    type: "text",
    label: "Alamat Usaha - Kode Pos",
    required: true,
    placeholder: "12190",
    helperText: "5 digit kode pos",
    validationPattern: "^[0-9]{5}$",
  },
  {
    id: "field-10",
    name: "businessProvince",
    type: "select",
    label: "Alamat Usaha - Provinsi",
    required: true,
    placeholder: "Pilih Provinsi",
    options: [
      "Bali",
      "Bangka Belitung",
      "Banten",
      "Bengkulu",
      "Daerah Istimewa Yogyakarta",
      "DKI Jakarta",
      "Gorontalo",
      "Jambi",
      "Jawa Barat",
      "Jawa Tengah",
      "Jawa Timur",
      "Kalimantan Barat",
      "Kalimantan Selatan",
      "Kalimantan Tengah",
      "Kalimantan Timur",
      "Kalimantan Utara",
      "Kepulauan Riau",
      "Lampung",
      "Maluku",
      "Maluku Utara",
      "Nanggroe Aceh Darussalam",
      "Nusa Tenggara Barat",
      "Nusa Tenggara Timur",
      "Papua",
      "Papua Barat",
      "Papua Barat Daya",
      "Papua Pegunungan",
      "Papua Selatan",
      "Papua Tengah",
      "Riau",
      "Sulawesi Barat",
      "Sulawesi Selatan",
      "Sulawesi Tengah",
      "Sulawesi Tenggara",
      "Sulawesi Utara",
      "Sumatera Barat",
      "Sumatera Selatan",
      "Sumatera Utara",
    ],
  },
  {
    id: "field-11",
    name: "companyPhoneNumber",
    type: "tel",
    label: "Alamat Usaha - Nomor Telpon Perusahaan",
    required: true,
    placeholder: "0215551234",
    helperText: "Nomor telepon kantor / perusahaan",
    validationPattern: "^\\+?[0-9]{6,16}$",
  },
  {
    id: "field-12",
    name: "verificationDocument1Type",
    type: "select",
    label: "Verifikasi Berkas (1)",
    required: true,
    placeholder: "Pilih jenis dokumen verifikasi 1",
    helperText:
      "Nama PT dan Alamat PT harus tercantum dan sesuai dengan yang anda masukkan diatas",
    options: [
      "Mutasi Rekening Bisnis",
      "Nomor Induk Berusaha (NIB)",
      "Izin Usaha Mikro Kecil (IUMK)",
      "Surat Pengukuhan Pengusaha Kena Pajak (SPPKP)",
      "Tanda Daftar Perusahaan (TDP)",
      "Surat Izin Usaha Perdagangan (SIUP)",
      "Tagihan Telpon",
      "Tagihan Air",
      "Tagihan Internet",
    ],
  },
  {
    id: "field-13",
    name: "verificationDocument1Url",
    type: "url",
    label: "URL File Verifikasi Berkas (1)",
    required: true,
    placeholder: "https://drive.google.com/file/d/...",
    helperText:
      "Masukkan URL File Berkas Anda (Google Drive / S3 / Direct Link)",
  },
  {
    id: "field-14",
    name: "verificationDocument2Type",
    type: "select",
    label: "Verifikasi Berkas (2)",
    required: true,
    placeholder: "Pilih jenis dokumen verifikasi 2",
    helperText:
      "Nama PT dan Alamat PT harus tercantum dan sesuai dengan yang anda masukkan diatas",
    options: ["Tagihan Telpon", "Tagihan Air", "Tagihan Internet"],
  },
  {
    id: "field-15",
    name: "verificationDocument2Url",
    type: "url",
    label: "URL File Verifikasi Berkas (2)",
    required: true,
    placeholder: "https://drive.google.com/file/d/...",
    helperText:
      "Masukkan URL File Berkas Anda (Google Drive / S3 / Direct Link)",
  },
  {
    id: "field-16",
    name: "agreement",
    type: "checkbox",
    label: "Persetujuan",
    required: true,
    options: [
      "Dengan melakukan order ini, saya sebagai perwakilan PT diatas dengan ini menyatakan menyetujui semua persyaratan dan memberikan akses ke PT. Premium Fast Network sebagai pihak penyedia layanan Whatsapp Business Official untuk mendaftarkan Atas Nama Perusahaan Saya selama layanan ini aktif. Jika terjadi keterlambatan pembayaran maka saya siap jika produk di hapus secara permanent.",
    ],
  },
  {
    id: "field-17",
    name: "messageQuotaAgreement",
    type: "checkbox",
    label: "Quota Pesan Detail",
    required: true,
    options: [
      "Quota pesan adalah batasan dari berapa banyak pesan yang bisa dikirimkan oleh nomor whatsapp, PT. Premium Fast Network hanya menagihkan quota pesan jika kirim pesan ke nomor baru, jika sudah pernah mengirimkan pesan sebelumnya dan sesi aktif 24 jam, maka quota tidak akan ditagihkan. Bebas mengirimkan pesan sebanyak apapun selama sesi 24 jam aktif.",
    ],
  },
]

export const WHATSAPP_PRIVATESHARE_FIELDS = [
  {
    id: "field-0",
    name: "phoneNumber",
    type: "tel",
    label: "Nomor Whatsapp",
    required: true,
    placeholder: "+6281234567890",
    helperText:
      "Silahkan siapkan nomor whatsapp yang ingin anda gunakan, bisa menggunakan nomor telpon kantor atau nomor mobile phone (Pastikan nomor tidak terdaftar di whatsapp biasa/bisnis pada HP Android atau IOS)",
    validationPattern: "^\\+?[0-9]{9,16}$",
  },
  {
    id: "field-1",
    name: "displayName",
    type: "text",
    label: "Nama Tampilan Whatsapp",
    required: true,
    placeholder: "Nama Bisnis / Brand",
    helperText:
      "Nama tampilan profil WhatsApp (Minimal 3, Maksimal 25 Karakter)",
  },
  {
    id: "field-2",
    name: "profilePicture",
    type: "url",
    label: "Foto Profile Whatsapp",
    required: true,
    placeholder: "https://example.com/logo.png",
    helperText: "Lampirkan Link Foto Profil WhatsApp Anda",
  },
]

async function main() {
  console.log("Seeding WhatsApp catalog dynamic provisioning fields...")

  // 1. Find WHATSAPP package
  const pkg = await prisma.servicePackage.findUnique({
    where: { code: "WHATSAPP" },
  })

  if (!pkg) {
    console.error("ServicePackage WHATSAPP not found!")
    return
  }

  // 2. Update PRIVATE plan
  const privatePlan = await prisma.servicePlan.findFirst({
    where: {
      packageId: pkg.id,
      code: "PRIVATE",
    },
  })

  if (privatePlan) {
    const existingResources = (privatePlan.resources ?? {}) as Record<
      string,
      unknown
    >
    await prisma.servicePlan.update({
      where: { id: privatePlan.id },
      data: {
        resources: {
          ...existingResources,
          provisioningFields: WHATSAPP_PRIVATE_FIELDS,
        } as Prisma.InputJsonValue,
      },
    })
    console.log("✓ Updated PRIVATE plan provisioning fields (18 fields)")
  } else {
    console.warn("! Plan PRIVATE not found under package WHATSAPP")
  }

  // 3. Update PRIVATESHARE plan
  const privateSharePlan = await prisma.servicePlan.findFirst({
    where: {
      packageId: pkg.id,
      code: "PRIVATESHARE",
    },
  })

  if (privateSharePlan) {
    const existingResources = (privateSharePlan.resources ?? {}) as Record<
      string,
      unknown
    >
    await prisma.servicePlan.update({
      where: { id: privateSharePlan.id },
      data: {
        resources: {
          ...existingResources,
          provisioningFields: WHATSAPP_PRIVATESHARE_FIELDS,
        } as Prisma.InputJsonValue,
      },
    })
    console.log("✓ Updated PRIVATESHARE plan provisioning fields (3 fields)")
  } else {
    console.warn("! Plan PRIVATESHARE not found under package WHATSAPP")
  }

  console.log("Done seeding WhatsApp provisioning fields!")
}

main()
  .catch((err) => {
    console.error("Seed error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
