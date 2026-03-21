import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, Trash2, UserIcon, RefreshCw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  users: any[];
  currentUserId: string;
  currentUserRole: string | null;
  currentUserEmail: string | undefined;
  onRefresh: () => void;
}

const SUPER_ADMIN_EMAIL = "dev@gmail.com";

export default function UsersTab({ users: initialUsers, currentUserId, currentUserRole, currentUserEmail, onRefresh }: Props) {
  const [localUsers, setLocalUsers] = useState<any[]>(initialUsers);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", password: "" });
  const [addingUser, setAddingUser] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Apne andar se fresh users fetch karo
  const fetchUsers = useCallback(async () => {
    try {
      // profiles aur user_roles alag fetch karo phir merge karo
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roles = rolesRes.data || [];
      const merged = (profilesRes.data || []).map(p => ({
        ...p,
        user_roles: roles
          .filter(r => r.user_id === p.id)
          .map(r => ({ role: r.role })),
      }));

      setLocalUsers(merged);
    } catch (err: any) {
      console.error("Users fetch failed:", err);
    }
  }, []);

  // Mount hone pe DB se fresh data lo
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleUserRole = async (targetUser: any, newRole: string) => {
    if (targetUser.email === SUPER_ADMIN_EMAIL) { toast.error("Owner cannot be modified!"); return; }
    if (updatingRoleId === targetUser.id) return;

    setUpdatingRoleId(targetUser.id);

    // Turant local UI update
    setLocalUsers(prev => prev.map(u =>
      u.id === targetUser.id
        ? { ...u, user_roles: [{ role: newRole }] }
        : u
    ));

    try {
      // Update try karo
      const { data: updateData, error: updateError } = await supabase
        .from("user_roles")
        .update({ role: newRole as 'user' | 'admin' })
        .eq("user_id", targetUser.id)
        .select();

      if (updateError) throw updateError;

      // Agar row nahi mila toh insert
      if (!updateData || updateData.length === 0) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({ user_id: targetUser.id, role: newRole as 'user' | 'admin' });
        if (insertError) throw insertError;
      }

      toast.success(`${targetUser.name || "User"} is now ${newRole.toUpperCase()}`);

      // DB se fresh data lo — cache bypass karne ke liye
      await fetchUsers();

    } catch (err: any) {
      console.error("Role update failed:", err);
      // Revert
      setLocalUsers(prev => prev.map(u =>
        u.id === targetUser.id
          ? { ...u, user_roles: targetUser.user_roles }
          : u
      ));
      toast.error("Failed: " + (err?.message || "Unknown error"));
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const approveUser = async (target: any) => {
    const targetId = typeof target === "string" ? target : target.id;
    const targetName = typeof target === "string" ? "User" : (target.name || "User");

    setLocalUsers(prev => prev.map(u =>
      u.id === targetId
        ? { ...u, is_approved: true, user_roles: u.user_roles?.length > 0 ? u.user_roles : [{ role: "user" }] }
        : u
    ));

    try {
      const { error } = await supabase.from("profiles").update({ is_approved: true }).eq("id", targetId);
      if (error) throw error;
      await supabase.from("user_roles").upsert({ user_id: targetId, role: "user" as 'user' | 'admin' }, { onConflict: "user_id" });
      toast.success(`${targetName} Approved!`);
      await fetchUsers();
    } catch (err: any) {
      setLocalUsers(prev => prev.map(u => u.id === targetId ? { ...u, is_approved: false } : u));
      toast.error("Approval fail: " + err.message);
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.name.trim() || !newUserForm.email.trim() || !newUserForm.password.trim()) { toast.error("All fields required!"); return; }
    if (newUserForm.password.length < 6) { toast.error("Password min 6 characters!"); return; }
    setAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "add_user", name: newUserForm.name.trim(), email: newUserForm.email.trim(), password: newUserForm.password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User created!");
      setNewUserForm({ name: "", email: "", password: "" });
      setIsAddUserOpen(false);
      await fetchUsers();
      onRefresh();
    } catch (err: any) { toast.error(err.message || "Unable to create user."); }
    finally { setAddingUser(false); }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeletingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", { body: { action: "delete_user", user_id: deleteUserId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLocalUsers(prev => prev.filter(u => u.id !== deleteUserId));
      toast.success("User deleted!");
      onRefresh();
    } catch (err: any) { toast.error(err.message || "Unable to delete user."); }
    finally { setDeletingUser(false); setDeleteUserId(null); }
  };

  return (
    <div className="space-y-2.5 pb-24 animate-in fade-in duration-500 px-3">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2 pt-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {["#4285F4","#EA4335","#FBBC05","#34A853"].map(c => (
              <div key={c} className="w-1.5 h-1.5 rounded-full" style={{background:c}} />
            ))}
          </div>
          <h2 className="font-bold text-gray-500 text-[10px] uppercase tracking-[0.15em]">Directory Control</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
          <button onClick={() => setIsAddUserOpen(true)}
            className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-[8px] font-black uppercase shadow-sm active:scale-95 transition-all">
            <UserIcon className="w-3 h-3" /> Add User
          </button>
        </div>
      </div>

      {/* Add User Form */}
      {isAddUserOpen && (
        <div className="bg-white p-4 rounded-[1.8rem] border border-gray-100 shadow-sm space-y-2 mb-3 animate-in fade-in duration-300">
          <p className="text-[8px] font-black uppercase tracking-widest text-blue-500 mb-2">New User</p>
          {[
            { placeholder: "Full Name *", type: "text", key: "name" },
            { placeholder: "Email *", type: "email", key: "email" },
            { placeholder: "Password *", type: "password", key: "password" },
          ].map(({ placeholder, type, key }) => (
            <input key={key} type={type} placeholder={placeholder}
              value={newUserForm[key as keyof typeof newUserForm]}
              onChange={e => setNewUserForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full p-2.5 rounded-xl bg-gray-50 text-foreground outline-none text-[10px] font-bold border border-gray-200 focus:ring-2 focus:ring-primary/20" />
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAddUser} disabled={addingUser}
              className="flex-1 flex items-center justify-center gap-1 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase disabled:opacity-50">
              {addingUser ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Create
            </button>
            <button onClick={() => { setIsAddUserOpen(false); setNewUserForm({ name: "", email: "", password: "" }); }}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-[9px] font-black uppercase">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="space-y-2">
        {localUsers.map((u: any) => {
          const currentRole = u.user_roles?.[0]?.role || "user";
          const isAdmin = currentRole === "admin";
          const isTargetSuper = u.email === SUPER_ADMIN_EMAIL;
          const isApproved = u.is_approved;
          const canManage = (currentUserRole === "admin" || currentUserEmail === SUPER_ADMIN_EMAIL) && !isTargetSuper && u.id !== currentUserId;
          const isUpdating = updatingRoleId === u.id;
          const themeColor = isTargetSuper ? "#4285F4" : isAdmin ? "#EA4335" : !isApproved ? "#FBBC05" : "#34A853";

          return (
            <div key={u.id}
              className="relative flex items-center gap-3 p-3 rounded-[1.8rem] bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all">

              {/* Avatar */}
              <div style={{ backgroundColor: themeColor }}
                className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm transition-colors duration-300">
                <span className="text-white font-black text-xs">{u.name?.charAt(0).toUpperCase()}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[12px] font-bold text-gray-800 truncate">{u.name}</p>
                  {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                </div>
                <p className="text-[9px] font-black truncate uppercase transition-all duration-300"
                  style={{ color: themeColor }}>
                  {isTargetSuper ? "Primary Owner" : isAdmin ? "System Admin" : !isApproved ? "Pending Approval" : "Active Staff"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 ml-auto flex items-center gap-1.5">
                {canManage ? (
                  <>
                    {!isApproved ? (
                      <button onClick={() => approveUser(u)}
                        className="px-4 py-2 bg-[#FBBC05] text-white rounded-full text-[9px] font-black uppercase shadow-md active:scale-90 transition-all">
                        Verify
                      </button>
                    ) : (
                      <div className="flex p-1 rounded-full border border-gray-100 bg-gray-50">
                        <button
                          onClick={() => !isAdmin && !isUpdating && toggleUserRole(u, "admin")}
                          disabled={isUpdating}
                          className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase transition-all duration-200 ${
                            isAdmin
                              ? "bg-[#EA4335] text-white shadow-sm"
                              : "text-gray-400 hover:text-[#EA4335]"
                          }`}>
                          Admin
                        </button>
                        <button
                          onClick={() => isAdmin && !isUpdating && toggleUserRole(u, "user")}
                          disabled={isUpdating}
                          className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase transition-all duration-200 ${
                            !isAdmin
                              ? "bg-[#34A853] text-white shadow-sm"
                              : "text-gray-400 hover:text-[#34A853]"
                          }`}>
                          Staff
                        </button>
                      </div>
                    )}
                    <button onClick={() => setDeleteUserId(u.id)}
                      className="p-1.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div style={{ color: themeColor, backgroundColor: `${themeColor}18`, border: `1px solid ${themeColor}30` }}
                    className="px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-tighter">
                    {isTargetSuper ? "Root" : isAdmin ? "Admin" : "User"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this user and all their data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={deletingUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingUser ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}