// src/utils/sweetalert.ts
import Swal from 'sweetalert2';

export const confirmDeleteAlert = async (
  title: string, 
  text: string, 
  confirmButtonText = 'Yes, Delete'
): Promise<boolean> => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#dc2626', // Tailwind red-600
    cancelButtonColor: '#334155',  // Tailwind slate-700
    background: '#0f172a',        // Tailwind slate-900
    color: '#f8fafc',             // Tailwind slate-50
    iconColor: '#f87171',         // Red icon
    heightAuto: false,            // Prevents body scroll jumping on mobile
    buttonsStyling: true,
    customClass: {
      popup: 'rounded-2xl border border-slate-800 shadow-2xl font-sans text-left max-w-[92vw] sm:max-w-md p-5',
      title: 'text-base sm:text-lg font-black text-white tracking-wide',
      htmlContainer: 'text-xs text-slate-300 mt-1',
      actions: 'flex items-center justify-end gap-2 mt-4 w-full',
      confirmButton: 'min-h-[44px] px-5 py-2 text-xs font-black uppercase tracking-wider rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg active:scale-95 transition cursor-pointer',
      cancelButton: 'min-h-[44px] px-5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shadow active:scale-95 transition cursor-pointer'
    }
  });

  return result.isConfirmed;
};

export const showSuccessToast = (title: string) => {
  Swal.fire({
    title,
    icon: 'success',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    background: '#0f172a',
    color: '#f8fafc',
    iconColor: '#34d399',
    customClass: {
      popup: 'rounded-xl border border-slate-800 shadow-xl font-sans text-xs font-bold'
    }
  });
};

export const showErrorAlert = (title: string, text?: string) => {
  Swal.fire({
    title,
    text: text || 'An unexpected error occurred. Please try again.',
    icon: 'error',
    confirmButtonText: 'OK',
    confirmButtonColor: '#3b82f6',
    background: '#0f172a',
    color: '#f8fafc',
    customClass: {
      popup: 'rounded-2xl border border-slate-800 shadow-2xl font-sans text-left max-w-[92vw] sm:max-w-md p-5',
      title: 'text-base font-black text-white',
      htmlContainer: 'text-xs text-slate-300 mt-1',
      confirmButton: 'min-h-[44px] px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white'
    }
  });
};
