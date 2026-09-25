// app/admin/users/page.tsx
"use client";

import React, { useState } from "react";
import AdminToast from "@/components/admin/AdminToast";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Sinh viên";
  status: "Hoạt động" | "Tạm khóa";
  createdAt: string;
}

const INITIAL_USERS: UserItem[] = [
  {
    id: "usr_1",
    name: "Quản trị viên DAU",
    email: "admin@dau.edu.vn",
    role: "Admin",
    status: "Hoạt động",
    createdAt: "2026-08-01",
  },
  {
    id: "usr_2",
    name: "Nguyễn Văn An",
    email: "an.nv26@sinhvien.dau.edu.vn",
    role: "Sinh viên",
    status: "Hoạt động",
    createdAt: "2026-08-15",
  },
  {
    id: "usr_3",
    name: "Trần Thị Mai",
    email: "mai.tt25@sinhvien.dau.edu.vn",
    role: "Sinh viên",
    status: "Hoạt động",
    createdAt: "2026-08-20",
  },
  {
    id: "usr_4",
    name: "Lê Hoàng Nam",
    email: "nam.lh24@sinhvien.dau.edu.vn",
    role: "Sinh viên",
    status: "Tạm khóa",
    createdAt: "2026-09-02",
  },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>(INITIAL_USERS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const newStatus = u.status === "Hoạt động" ? "Tạm khóa" : "Hoạt động";
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
    setToastMessage("Đã cập nhật trạng thái người dùng (Local demo).");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Quản lý tài khoản
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Danh sách người dùng và phân quyền truy cập hệ thống DAU Second Brain.
        </p>
      </div>

      {/* 2. Mandatory Prototype Notice (Section 23) */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h4 className="font-bold text-amber-900">Thông báo quan trọng về phân hệ tài khoản</h4>
          <p className="mt-0.5 leading-relaxed text-amber-800">
            Đây là giao diện quản trị tài khoản ở mức prototype. Hệ thống xác thực và phân quyền backend chưa được triển khai hoàn chỉnh.
          </p>
        </div>
      </div>

      {/* 3. Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3.5 px-4">Người dùng</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Vai trò</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Ngày tạo</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === "Admin"
                          ? "bg-purple-50 text-purple-700 border border-purple-100"
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.status === "Hoạt động"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          u.status === "Hoạt động" ? "bg-emerald-500" : "bg-amber-500"
                        }`}
                      />
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{u.createdAt}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => toggleStatus(u.id)}
                      className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      {u.status === "Hoạt động" ? "Khóa" : "Mở khóa"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      <AdminToast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
