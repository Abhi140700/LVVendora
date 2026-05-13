import toast from "react-hot-toast";

const defaultToastOptions = {
    style: {
        background: "#16201b",
        color: "#f5f4ee",
        border: "1px solid rgba(184, 143, 58, 0.28)",
    },
};

export const notifySuccess = (message) => toast.success(message, defaultToastOptions);
export const notifyError = (message) => toast.error(message, defaultToastOptions);
export const notifyInfo = (message) => toast(message, { ...defaultToastOptions, icon: "ℹ️" });
export const confirmAction = async (message) => window.confirm(message);
