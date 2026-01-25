"use client"

import React, { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import axios from "axios"
import { User, FileText, Briefcase, CreditCard, MapPin, Lock, ChevronRight, ChevronLeft, Check, Upload, AlertCircle, Mail, Phone, Calendar, Building2, XCircle } from "lucide-react"

type FormDataType = {
  refer_code: string
  entry_sponsor: string
  is_agent: boolean
  first_name: string
  last_name: string
  email: string
  phone: string
  gender: string
  father_name: string
  mother_name: string
  birth_date: string
  qualification: string
  marital_status: string
  blood_group: string
  emergency_person_name: string
  emergency_person_mobile: string
  aadhar_card_no: string
  pan_card_no: string
  designation: string
  sales_target: string
  branch: string
  area: string
  state: string
  payment_method: string
  bank_name: string
  bank_branch: string
  ifsc_code: string
  account_name: string
  account_number: string
  address_1: string
  address_2: string
  city: string
  pin_code: string
  country: string
  address_state: string
  password: string
  confirm_password: string
  agree_to_policy: boolean
}

export default function RegisterPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [formData, setFormData] = useState<FormDataType>({
    refer_code: "",
    entry_sponsor: "",
    is_agent: true,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    father_name: "",
    mother_name: "",
    birth_date: "",
    qualification: "",
    marital_status: "",
    blood_group: "",
    emergency_person_name: "",
    emergency_person_mobile: "",
    aadhar_card_no: "",
    pan_card_no: "",
    designation: "agent",
    sales_target: "",
    branch: "",
    area: "",
    state: "",
    payment_method: "Bank Transfer",
    bank_name: "",
    bank_branch: "",
    ifsc_code: "",
    account_name: "",
    account_number: "",
    address_1: "",
    address_2: "",
    city: "",
    pin_code: "",
    country: "",
    address_state: "",
    password: "",
    confirm_password: "",
    agree_to_policy: false,
  })

  const [files, setFiles] = useState<{
    aadhar_card_photo?: File | null
    pan_card_photo?: File | null
  }>({})

  const [uploadedUrls, setUploadedUrls] = useState<{
    aadhar_card_photo?: string
    pan_card_photo?: string
  }>({})

  const [uploadStatus, setUploadStatus] = useState<{
    aadhar_card_photo?: "uploading" | "success" | "error"
    pan_card_photo?: "uploading" | "success" | "error"
  }>({})

  const [uploadErrors, setUploadErrors] = useState<{
    aadhar_card_photo?: string
    pan_card_photo?: string
  }>({})

  const [availableBranches, setAvailableBranches] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)

  const [error, setError] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>("")

  // Fetch branches on mount
  React.useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoadingBranches(true)
        const response = await axios.get("/api/affiliate/branches")
        if (response.data.success) {
          setAvailableBranches(response.data.branches)
        }
      } catch (err) {
        console.error("Failed to fetch branches:", err)
      } finally {
        setLoadingBranches(false)
      }
    }
    fetchBranches()
  }, [])

  // Helper functions for formatting
  const formatPhone = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Limit to 10 digits
    return digits.slice(0, 10)
  }

  const formatAadhar = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Limit to 12 digits
    const limited = digits.slice(0, 12)
    // Format as XXXX XXXX XXXX
    if (limited.length <= 4) return limited
    if (limited.length <= 8) return `${limited.slice(0, 4)} ${limited.slice(4)}`
    return `${limited.slice(0, 4)} ${limited.slice(4, 8)} ${limited.slice(8)}`
  }

  const formatPAN = (value: string) => {
    // Remove all non-alphanumeric and convert to uppercase
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    // Limit to 10 characters
    return cleaned.slice(0, 10)
  }

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  // Calculate min and max dates for birth date
  const getMaxBirthDate = () => {
    // Must be at least 18 years old
    const date = new Date()
    date.setFullYear(date.getFullYear() - 18)
    return date.toISOString().split('T')[0]
  }

  const getMinBirthDate = () => {
    // Maximum age 100 years
    const date = new Date()
    date.setFullYear(date.getFullYear() - 100)
    return date.toISOString().split('T')[0]
  }

  const steps = [
    { id: 1, name: "Personal Info", icon: User },
    { id: 2, name: "Details", icon: FileText },
    { id: 3, name: "Work Info", icon: Briefcase },
    { id: 4, name: "Payment", icon: CreditCard },
    { id: 5, name: "Security", icon: Lock },
  ]

  const handleFileChange = async (field: "aadhar_card_photo" | "pan_card_photo", file: File | null) => {
    if (!file) {
      setFiles((prev) => ({ ...prev, [field]: null }))
      setUploadedUrls((prev) => ({ ...prev, [field]: undefined }))
      setUploadStatus((prev) => ({ ...prev, [field]: undefined }))
      setUploadErrors((prev) => ({ ...prev, [field]: undefined }))
      return
    }

    // Validate email is filled
    if (!formData.email) {
      setUploadErrors((prev) => ({ ...prev, [field]: "Please enter your email first" }))
      setUploadStatus((prev) => ({ ...prev, [field]: "error" }))
      return
    }

    setFiles((prev) => ({ ...prev, [field]: file }))
    setUploadStatus((prev) => ({ ...prev, [field]: "uploading" }))
    setUploadErrors((prev) => ({ ...prev, [field]: undefined }))

    try {
      const uploadFormData = new FormData()
      uploadFormData.append("file", file)
      uploadFormData.append("email", formData.email)
      uploadFormData.append("docType", field === "aadhar_card_photo" ? "aadhar" : "pancard")

      const response = await axios.post("/api/affiliate/upload-document", uploadFormData)
      const data = response.data

      if (data.success) {
        setUploadedUrls((prev) => ({ ...prev, [field]: data.url }))
        setUploadStatus((prev) => ({ ...prev, [field]: "success" }))
      } else {
        throw new Error(data.message || "Upload failed")
      }
    } catch (err: any) {
      console.error(`Failed to upload ${field}:`, err)
      setUploadErrors((prev) => ({ ...prev, [field]: err.response?.data?.message || err.message || "Upload failed" }))
      setUploadStatus((prev) => ({ ...prev, [field]: "error" }))
    }
  }

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone) {
        setError("First name, last name, email, and mobile are required")
        return false
      }
    }
    if (step === 2) {
      if (!formData.gender || !formData.birth_date || !formData.father_name || !formData.mother_name) {
        setError("Please fill required personal details")
        return false
      }
      if (calculateAge(formData.birth_date) < 18) {
        setError("You must be at least 18 years old to register")
        return false
      }
      if (!formData.aadhar_card_no || !formData.pan_card_no) {
        setError("Aadhar and PAN number are required")
        return false
      }
    }
    if (step === 3) {
      if (!formData.designation) {
        setError("Please select your designation")
        return false
      }
    }
    if (step === 4) {
      if (formData.payment_method === "Bank Transfer") {
        if (!formData.bank_name || !formData.ifsc_code || !formData.account_number || !formData.account_name) {
          setError("Please fill bank details for Bank Transfer")
          return false
        }
      }
    }

    setError("")
    return true
  }

  const nextStep = () => {
    if (validateStep(currentStep)) setCurrentStep((s) => Math.min(5, s + 1))
  }

  const prevStep = () => setCurrentStep((s) => Math.max(1, s - 1))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    if (!formData.password || !formData.confirm_password) {
      setError("Password and confirm password are required")
      return
    }
    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match")
      return
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    if (!formData.agree_to_policy) {
      setError("You must agree to the Agent Policy")
      return
    }

    setLoading(true)

    try {
      const payload = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        if (typeof value === "boolean") payload.append(key, value ? "true" : "false")
        else payload.append(key, (value as any) ?? "")
      })

      // Send S3 URLs from instant upload (not File objects)
      if (uploadedUrls.aadhar_card_photo) {
        payload.append("aadhar_card_photo_url", uploadedUrls.aadhar_card_photo)
      }
      if (uploadedUrls.pan_card_photo) {
        payload.append("pan_card_photo_url", uploadedUrls.pan_card_photo)
      }

      // Use Next.js API route (not Medusa backend)
      const response = await axios.post("/api/affiliate/register", payload)
      const data = response.data

      localStorage.setItem("affiliate_user", JSON.stringify(data.user))
      setSuccessMessage("Registration successful! Your application is pending verification.")
      setLoading(false)

      setTimeout(() => {
        router.push("/verification-pending")
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.message || err?.message || "Failed to submit form")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/uploads/coin/Oweg3d-400.png"
            alt="Oweg Logo"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
            Agent Registration
          </h1>
          <p className="text-gray-600">Join our network and start your journey with us</p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isCompleted
                      ? "bg-gradient-to-br from-green-500 to-emerald-600 scale-110 shadow-lg"
                      : isActive
                        ? "bg-gradient-to-br from-emerald-600 to-teal-600 scale-110 shadow-lg"
                        : "bg-gray-200"
                      }`}>
                      {isCompleted ? (
                        <Check className="w-6 h-6 text-white" />
                      ) : (
                        <Icon className={`w-6 h-6 ${isActive ? "text-white" : "text-gray-400"}`} />
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${isActive ? "text-emerald-600 font-bold" : "text-gray-500"}`}>
                      {step.name}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`h-1 flex-1 mx-2 transition-all duration-300 ${isCompleted ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gray-200"}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white shadow-2xl rounded-3xl overflow-hidden">
          <div className="p-8">
            {/* Alerts */}
            {error && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl">
                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Success</p>
                  <p className="text-sm">{successMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                      <User className="w-6 h-6 text-emerald-600" />
                      Personal Information
                    </h2>
                    <p className="text-gray-600 mt-1 text-sm">Tell us about yourself</p>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          placeholder="John"
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          placeholder="Doe"
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="email"
                            required
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                            placeholder="john.doe@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Mobile <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="tel"
                            required
                            pattern="[0-9]{10}"
                            maxLength={10}
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                            placeholder="9876543210"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                          />
                          {formData.phone && formData.phone.length !== 10 && (
                            <p className="mt-1 text-xs text-red-600">Mobile number must be exactly 10 digits</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Additional Details */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                      <FileText className="w-6 h-6 text-emerald-600" />
                      Additional Details
                    </h2>
                    <p className="text-gray-600 mt-1 text-sm">Complete your profile information</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Gender <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Birth Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                        <input
                          type="date"
                          required
                          min={getMinBirthDate()}
                          max={getMaxBirthDate()}
                          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          value={formData.birth_date}
                          onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                        />
                      </div>
                      {formData.birth_date && calculateAge(formData.birth_date) < 18 && (
                        <p className="mt-1 text-xs text-red-600">You must be at least 18 years old to register</p>
                      )}
                      {formData.birth_date && calculateAge(formData.birth_date) >= 18 && (
                        <p className="mt-1 text-xs text-green-600">Age: {calculateAge(formData.birth_date)} years</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Father's Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="Father's Name"
                        value={formData.father_name}
                        onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Mother's Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="Mother's Name"
                        value={formData.mother_name}
                        onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Qualification</label>
                      <select
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        value={formData.qualification}
                        onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      >
                        <option value="">Select qualification</option>
                        <option value="high_school">High School</option>
                        <option value="diploma">Diploma</option>
                        <option value="bachelor">Bachelor's Degree</option>
                        <option value="master">Master's Degree</option>
                        <option value="phd">PhD</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Marital Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        value={formData.marital_status}
                        onChange={(e) => setFormData({ ...formData, marital_status: e.target.value })}
                      >
                        <option value="">Select status</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Blood Group</label>
                      <select
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        value={formData.blood_group}
                        onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                      >
                        <option value="">Select blood group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Emergency Contact Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="Emergency contact name"
                        value={formData.emergency_person_name}
                        onChange={(e) => setFormData({ ...formData, emergency_person_name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Emergency Contact Mobile <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        pattern="[0-9]{10}"
                        maxLength={10}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="9876543210"
                        value={formData.emergency_person_mobile}
                        onChange={(e) => setFormData({ ...formData, emergency_person_mobile: formatPhone(e.target.value) })}
                      />
                      {formData.emergency_person_mobile && formData.emergency_person_mobile.length !== 10 && (
                        <p className="mt-1 text-xs text-red-600">Mobile number must be exactly 10 digits</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Aadhar Card Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={14}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="1234 5678 9012"
                        value={formData.aadhar_card_no}
                        onChange={(e) => setFormData({ ...formData, aadhar_card_no: formatAadhar(e.target.value) })}
                      />
                      {formData.aadhar_card_no && formData.aadhar_card_no.replace(/\s/g, '').length !== 12 && (
                        <p className="mt-1 text-xs text-red-600">Aadhar number must be 12 digits</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        PAN Card Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black uppercase"
                        placeholder="ABCDE1234F"
                        value={formData.pan_card_no}
                        onChange={(e) => setFormData({ ...formData, pan_card_no: formatPAN(e.target.value) })}
                      />
                      {formData.pan_card_no && formData.pan_card_no.length !== 10 && (
                        <p className="mt-1 text-xs text-red-600">PAN must be 10 characters (5 letters, 4 digits, 1 letter)</p>
                      )}
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Aadhar Card Photo</label>
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          onChange={(e) => handleFileChange("aadhar_card_photo", e.target.files?.[0] || null)}
                          disabled={uploadStatus.aadhar_card_photo === "uploading"}
                        />
                        {uploadStatus.aadhar_card_photo === "uploading" && (
                          <p className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                            <span className="animate-spin">⏳</span>
                            Uploading to S3...
                          </p>
                        )}
                        {uploadStatus.aadhar_card_photo === "success" && files.aadhar_card_photo && (
                          <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            ✓ {files.aadhar_card_photo.name} - Uploaded successfully!
                          </p>
                        )}
                        {uploadStatus.aadhar_card_photo === "error" && (
                          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            {uploadErrors.aadhar_card_photo || "Upload failed"}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">PAN Card Photo</label>
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          onChange={(e) => handleFileChange("pan_card_photo", e.target.files?.[0] || null)}
                          disabled={uploadStatus.pan_card_photo === "uploading"}
                        />
                        {uploadStatus.pan_card_photo === "uploading" && (
                          <p className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                            <span className="animate-spin">⏳</span>
                            Uploading to S3...
                          </p>
                        )}
                        {uploadStatus.pan_card_photo === "success" && files.pan_card_photo && (
                          <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            ✓ {files.pan_card_photo.name} - Uploaded successfully!
                          </p>
                        )}
                        {uploadStatus.pan_card_photo === "error" && (
                          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            {uploadErrors.pan_card_photo || "Upload failed"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Work Information */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                      <Briefcase className="w-6 h-6 text-emerald-600" />
                      Work Information
                    </h2>
                    <p className="text-gray-600 mt-1 text-sm">Tell us about your professional details</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Designation
                      </label>
                      <input
                        type="text"
                        readOnly
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                        value="Agent"
                      />
                      <p className="mt-1 text-xs text-gray-500">All registrants join as agents</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Sales Target</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="Enter sales target"
                        value={formData.sales_target}
                        onChange={(e) => setFormData({ ...formData, sales_target: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Branch</label>
                      <select
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                        disabled={loadingBranches}
                      >
                        <option value="">{loadingBranches ? "Loading branches..." : "Select branch"}</option>
                        {availableBranches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>

                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Area</label>
                      <select
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      >
                        <option value="">Select area</option>
                        <option value="urban">Urban</option>
                        <option value="rural">Rural</option>
                        <option value="suburban">Suburban</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="State"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="City"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Address Line 1</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="Address line 1"
                        value={formData.address_1}
                        onChange={(e) => setFormData({ ...formData, address_1: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Pin Code</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                        placeholder="Pin code"
                        value={formData.pin_code}
                        onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Payment Details */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                      <CreditCard className="w-6 h-6 text-emerald-600" />
                      Payment Details
                    </h2>
                    <p className="text-gray-600 mt-1 text-sm">Setup how you'd like to receive payments</p>
                  </div>

                  <div className="space-y-5">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                      <p className="text-sm font-semibold text-emerald-800">Payment Method: Bank Transfer</p>
                      <p className="text-xs text-emerald-600 mt-1">All payments will be processed via bank transfer</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name</label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={formData.bank_name}
                            onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                            placeholder="Bank name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Account Name</label>
                        <input
                          type="text"
                          value={formData.account_name}
                          onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          placeholder="Account holder name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number</label>
                        <input
                          type="text"
                          value={formData.account_number}
                          onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          placeholder="Account number"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">IFSC Code</label>
                        <input
                          type="text"
                          value={formData.ifsc_code}
                          onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          placeholder="IFSC code"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Security */}
              {currentStep === 5 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                      <Lock className="w-6 h-6 text-emerald-600" />
                      Security & Finalize
                    </h2>
                    <p className="text-gray-600 mt-1 text-sm">Set your password and complete registration</p>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          placeholder="••••••••"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={formData.confirm_password}
                          onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-500 text-black"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">Uploaded Documents:</p>
                      <ul className="space-y-1 text-sm text-gray-600">
                        <li className="flex items-center gap-2">
                          {files.aadhar_card_photo ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              <span>Aadhar: {files.aadhar_card_photo.name}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">Aadhar not uploaded</span>
                          )}
                        </li>
                        <li className="flex items-center gap-2">
                          {files.pan_card_photo ? (
                            <>
                              <Check className="w-4 h-4 text-green-600" />
                              <span>PAN: {files.pan_card_photo.name}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">PAN not uploaded</span>
                          )}
                        </li>
                      </ul>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <input
                        id="agree"
                        type="checkbox"
                        checked={formData.agree_to_policy}
                        onChange={(e) => setFormData({ ...formData, agree_to_policy: e.target.checked })}
                        className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                      />
                      <label htmlFor="agree" className="text-sm text-gray-700">
                        I agree to the <span className="font-semibold text-emerald-700">Agent Policy</span> and confirm that all information provided is accurate
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-200">
                <div>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-all flex items-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {currentStep < 5 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg transition-all flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Complete Registration
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>

            {/* Already have account link */}
            <div className="mt-6 text-center pt-6 border-t border-gray-200">
              <p className="text-gray-600 text-sm">
                Already have an account?{" "}
                <a href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  Sign in here
                </a>
              </p>
            </div>
          </div>
        </div>
      </div >
    </div >
  )
}




