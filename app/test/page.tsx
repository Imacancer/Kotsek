"use client";

import axios from "axios";
import { useEffect, useState } from "react";

interface User {
  createdAt: string;
  email: string;
  id: string;
  username: string;
}

const Test = () => {
  const [user, setUser] = useState<User[]>([]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get<User[]>("http://localhost:5001/users");
        setUser(response.data);
        console.log(response.data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="flex flex-col gap-4 items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold">Hello World</h1>
        <div>
          {user?.map((user) => (
            <div
              key={user.id}
              className="p-4 border border-gray-300 rounded-md mb-4"
            >
              <p>
                <strong>Username:</strong> {user.username}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Created At:</strong> {user.createdAt}
              </p>
              <p>
                <strong>ID:</strong> {user.id}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Test;
