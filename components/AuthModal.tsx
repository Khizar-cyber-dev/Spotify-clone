"use client";

import { useSessionContext, useSupabaseClient } from "@supabase/auth-helpers-react";
import Modal from "./Modal";
import { useRouter } from "next/navigation";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect } from "react";
import useAuthModal from "@/hooks/useAuthModal";

const AuthModal = () => {
  const supabaseCleint = useSupabaseClient();
  const router = useRouter();
  const { session } = useSessionContext();
  const { onClose, isOpen } = useAuthModal();

  const onChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  useEffect(() => {
    if(session){
      router.refresh();
      onClose();
    }
  },[session, router, onClose]);

  return (
    <Modal
      title="Welcome back!"
      description="Login to your account."
      isOpen={isOpen}
      onChange={onChange}
    >
     <Auth theme='dark' magicLink providers={["google"]} supabaseClient={supabaseCleint} appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: '#404040', brandAccent: '#22c55e'}}} }}/>
    </Modal>
  );
}

export default AuthModal;