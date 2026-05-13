import React, { useEffect, useState } from "react";
import api from "../../app/axios";
import { CrudMeta, CrudPage, CrudPanel } from "../../components/ui/CrudPage";

const UserList = () => {
    const [users, setUsers] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const { data } = await api.get("/users");
                setUsers(data.data || []);
            } catch (err) {
                setError(err.response?.data?.message || err.message);
            }
        };

        fetchUsers();
    }, []);

    return (
        <CrudPage
            eyebrow="Users"
            title="User Directory"
            description="View the active application users and the roles currently assigned to each account."
            meta={(
                <>
                    <CrudMeta>{users.length} users</CrudMeta>
                    <CrudMeta>{error ? "Attention needed" : "Directory synced"}</CrudMeta>
                </>
            )}
        >
            <CrudPanel className="crud-page__panel--tight">
                {error ? <div className="app-message crud-page__error">{error}</div> : null}
                <div className="app-card table-surface app-table-card">
                    <table>
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="2" className="crud-page__empty">No users found</td>
                                </tr>
                            ) : users.map((user) => (
                                <tr key={user._id}>
                                    <td>{user.username}</td>
                                    <td className="crud-page__capitalize">{user.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CrudPanel>
        </CrudPage>
    );
};

export default UserList;
