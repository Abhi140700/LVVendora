const useAuth = () => ({
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role"),
    username: localStorage.getItem("username"),
    isAuthenticated: Boolean(localStorage.getItem("token")),
});

export default useAuth;
